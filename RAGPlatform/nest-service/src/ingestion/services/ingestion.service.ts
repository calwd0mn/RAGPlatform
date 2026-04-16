import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Document as LangChainDocument } from '@langchain/core/documents';
import { Model, Types } from 'mongoose';
import { DocumentStatusEnum } from '../../documents/interfaces/document-status.type';
import {
  Document,
  DocumentDocument,
} from '../../documents/schemas/document.schema';
import { ChunkMetadataBuilder } from '../builders/chunk-metadata.builder';
import { IngestionEmbeddingsFactory } from '../embeddings/embeddings.factory';
import { IngestionResult } from '../interfaces/ingestion-result.interface';
import { LangchainDocumentMapper } from '../mappers/langchain-document.mapper';
import { DocumentLoaderFactory } from '../loaders/document-loader.factory';
import { Chunk, ChunkDocument } from '../schemas/chunk.schema';
import { TextSplitterFactory } from '../splitters/text-splitter.factory';

const STARTABLE_STATUSES: readonly DocumentStatusEnum[] = [
  DocumentStatusEnum.Uploaded,
  DocumentStatusEnum.Failed,
];

@Injectable()
export class IngestionService {
  constructor(
    @InjectModel(Document.name)
    private readonly documentModel: Model<DocumentDocument>,
    @InjectModel(Chunk.name)
    private readonly chunkModel: Model<ChunkDocument>,
    private readonly documentLoaderFactory: DocumentLoaderFactory,
    private readonly textSplitterFactory: TextSplitterFactory,
    private readonly embeddingsFactory: IngestionEmbeddingsFactory,
    private readonly langchainDocumentMapper: LangchainDocumentMapper,
    private readonly chunkMetadataBuilder: ChunkMetadataBuilder,
  ) {}

  async start(userId: string, documentId: string): Promise<IngestionResult> {
    const normalizedUserId = this.toObjectId(userId);
    const normalizedDocumentId = this.toObjectId(documentId);

    const document = await this.documentModel
      .findOneAndUpdate(
        {
          _id: normalizedDocumentId,
          userId: normalizedUserId,
          status: {
            $in: STARTABLE_STATUSES,
          },
        },
        { status: DocumentStatusEnum.Parsing, errorMessage: undefined },
        { new: true },
      )
      .exec();

    if (!document) {
      await this.raiseStartConflictReason(normalizedUserId, normalizedDocumentId);
      throw new InternalServerErrorException('Unable to start ingestion');
    }

    const lockedDocument = document;

    try {
      const loadedDocuments = await this.documentLoaderFactory.load({
        storagePath: lockedDocument.storagePath,
        originalName: lockedDocument.originalName,
        mimeType: lockedDocument.mimeType,
      });

      if (loadedDocuments.length === 0) {
        throw new BadRequestException('Document has no readable content');
      }

      const mappedDocuments = this.langchainDocumentMapper.mapLoadedDocuments({
        loadedDocuments,
        userId,
        documentId: lockedDocument.id,
        originalName: lockedDocument.originalName,
        mimeType: lockedDocument.mimeType,
      });

      await this.updateStatus(
        lockedDocument,
        normalizedUserId,
        DocumentStatusEnum.Parsed,
      );

      const splitter = this.textSplitterFactory.createSplitter();
      const chunkDocuments = await splitter.splitDocuments(mappedDocuments);

      if (chunkDocuments.length === 0) {
        throw new BadRequestException('Document content is empty after split');
      }

      await this.updateStatus(
        lockedDocument,
        normalizedUserId,
        DocumentStatusEnum.Chunked,
      );

      const chunksForEmbedding = chunkDocuments.map(
        (
          chunkDocument: LangChainDocument,
          chunkIndex: number,
        ): LangChainDocument =>
          new LangChainDocument({
            pageContent: chunkDocument.pageContent,
            metadata: this.chunkMetadataBuilder.build({
              metadata: chunkDocument.metadata,
              originalName: lockedDocument.originalName,
              mimeType: lockedDocument.mimeType,
              documentId: lockedDocument.id,
              userId,
            }),
            id: `${lockedDocument.id}-${chunkIndex}`,
          }),
      );

      const embeddings = this.embeddingsFactory.createEmbeddings();
      const vectors = await embeddings.embedDocuments(
        chunksForEmbedding.map((chunk): string => chunk.pageContent),
      );

      if (vectors.length !== chunksForEmbedding.length) {
        throw new InternalServerErrorException(
          'Embedding result size mismatch',
        );
      }

      await this.updateStatus(
        lockedDocument,
        normalizedUserId,
        DocumentStatusEnum.Embedded,
      );

      await this.chunkModel
        .deleteMany({
          userId: normalizedUserId,
          documentId: normalizedDocumentId,
        })
        .exec();

      const chunkPayload = chunksForEmbedding.map(
        (chunkDocument, chunkIndex): Partial<Chunk> => ({
          userId: normalizedUserId,
          documentId: normalizedDocumentId,
          chunkIndex,
          content: chunkDocument.pageContent,
          embedding: vectors[chunkIndex],
          metadata: chunkDocument.metadata,
        }),
      );

      await this.chunkModel.insertMany(chunkPayload, { ordered: true });

      await this.documentModel
        .updateOne(
          { _id: lockedDocument._id, userId: normalizedUserId },
          { status: DocumentStatusEnum.Ready, errorMessage: undefined },
        )
        .exec();

      return {
        documentId: lockedDocument.id,
        finalStatus: DocumentStatusEnum.Ready,
        chunkCount: chunkPayload.length,
        message: 'Ingestion completed successfully',
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      await this.chunkModel
        .deleteMany({
          userId: normalizedUserId,
          documentId: normalizedDocumentId,
        })
        .exec();
      await this.documentModel
        .updateOne(
          { _id: lockedDocument._id, userId: normalizedUserId },
          { status: DocumentStatusEnum.Failed, errorMessage },
        )
        .exec();

      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to ingest document');
    }
  }

  private ensureStatusCanStart(status: DocumentStatusEnum): void {
    if (status === DocumentStatusEnum.Ready) {
      throw new ConflictException('Document is already ingested');
    }

    if (status === DocumentStatusEnum.Parsing) {
      throw new ConflictException('Document is being ingested');
    }

    if (!STARTABLE_STATUSES.includes(status)) {
      throw new BadRequestException('Document status does not allow ingestion');
    }
  }

  private async raiseStartConflictReason(
    userId: Types.ObjectId,
    documentId: Types.ObjectId,
  ): Promise<never> {
    const latestDocument = await this.documentModel
      .findOne({ _id: documentId, userId })
      .exec();

    if (!latestDocument) {
      throw new NotFoundException('Document not found');
    }

    this.ensureStatusCanStart(latestDocument.status);

    throw new ConflictException('Document is being ingested');
  }

  private async updateStatus(
    document: DocumentDocument,
    userId: Types.ObjectId,
    status: DocumentStatusEnum,
  ): Promise<void> {
    await this.documentModel
      .updateOne({ _id: document._id, userId }, { status })
      .exec();
  }

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }

    return new Types.ObjectId(value);
  }

  private extractErrorMessage(error: { message?: string }): string {
    const message = (error.message ?? '').trim();
    if (message.length === 0) {
      return 'Unknown ingestion error';
    }
    return message.length > 1000 ? message.slice(0, 1000) : message;
  }
}
