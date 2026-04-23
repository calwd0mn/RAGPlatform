import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
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
import { IngestionResult } from '../interfaces/ingestion-result.interface';
import { LangchainDocumentMapper } from '../mappers/langchain-document.mapper';
import { DocumentLoaderFactory } from '../loaders/document-loader.factory';
import { Chunk, ChunkDocument } from '../schemas/chunk.schema';
import { TextSplitterFactory } from '../splitters/text-splitter.factory';
import { ChunkVectorStoreService } from '../vector-stores/chunk-vector-store.service';

const STARTABLE_STATUSES: readonly DocumentStatusEnum[] = [
  DocumentStatusEnum.Uploaded,
  DocumentStatusEnum.Failed,
];

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @InjectModel(Document.name)
    private readonly documentModel: Model<DocumentDocument>,
    @InjectModel(Chunk.name)
    private readonly chunkModel: Model<ChunkDocument>,
    private readonly documentLoaderFactory: DocumentLoaderFactory,
    private readonly textSplitterFactory: TextSplitterFactory,
    private readonly langchainDocumentMapper: LangchainDocumentMapper,
    private readonly chunkMetadataBuilder: ChunkMetadataBuilder,
    private readonly chunkVectorStoreService: ChunkVectorStoreService,
  ) {}

  async start(userId: string, documentId: string): Promise<IngestionResult> {
    const normalizedUserId = this.toObjectId(userId);
    const normalizedDocumentId = this.toObjectId(documentId);
    // 给状态上锁，避免并发重复提交
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
      await this.raiseStartConflictReason(
        normalizedUserId,
        normalizedDocumentId,
      );
      throw new InternalServerErrorException('Unable to start ingestion');
    }

    const lockedDocument = document;
    // 加载文件
    try {
      const loadedDocuments = await this.documentLoaderFactory.load({
        storagePath: lockedDocument.storagePath,
        originalName: lockedDocument.originalName,
        mimeType: lockedDocument.mimeType, // Document Type
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

      const splitter =
        typeof lockedDocument.activeChunkSize === 'number' &&
        typeof lockedDocument.activeChunkOverlap === 'number'
          ? this.textSplitterFactory.createSplitterByConfig({
              chunkSize: lockedDocument.activeChunkSize,
              chunkOverlap: lockedDocument.activeChunkOverlap,
              splitterType: lockedDocument.activeChunkSplitterType,
              preserveSentenceBoundary:
                lockedDocument.activeChunkPreserveSentenceBoundary,
            })
          : this.textSplitterFactory.createSplitter();
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

      const chunkCount =
        await this.chunkVectorStoreService.replaceDocumentChunks({
          userId: normalizedUserId,
          knowledgeBaseId: lockedDocument.knowledgeBaseId,
          documentId: normalizedDocumentId,
          chunks: chunksForEmbedding,
        });

      await this.updateStatus(
        lockedDocument,
        normalizedUserId,
        DocumentStatusEnum.Embedded,
      );

      await this.documentModel
        .updateOne(
          { _id: lockedDocument._id, userId: normalizedUserId },
          { status: DocumentStatusEnum.Ready, errorMessage: undefined },
        )
        .exec();

      return {
        documentId: lockedDocument.id,
        finalStatus: DocumentStatusEnum.Ready,
        chunkCount,
        message: 'Ingestion completed successfully',
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(
        `Failed to ingest document ${lockedDocument.id}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
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
