import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DOCUMENT_MAX_FILE_SIZE } from '../constants/document.constants';
import { DocumentResponse } from '../interfaces/document-response.interface';
import { DocumentStatusEnum } from '../interfaces/document-status.type';
import { UploadedDocumentFile } from '../interfaces/uploaded-document-file.interface';
import { Document, DocumentDocument } from '../schemas/document.schema';
import { Chunk, ChunkDocument } from '../../ingestion/schemas/chunk.schema';
import {
  DebugExperimentChunk,
  DebugExperimentChunkDocument,
} from '../../schemas/debug-experiment-chunk.schema';
import {
  buildDocumentStoragePath,
  isAllowedDocumentFileType,
  normalizeUploadedOriginalName,
  removeStoredDocumentFile,
} from '../utils/document-file.util';
import { KnowledgeBasesService } from '../../knowledge-bases/knowledge-bases.service';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectModel(Document.name)
    private readonly documentModel: Model<DocumentDocument>,
    @InjectModel(Chunk.name)
    private readonly chunkModel: Model<ChunkDocument>,
    @InjectModel(DebugExperimentChunk.name)
    private readonly debugExperimentChunkModel: Model<DebugExperimentChunkDocument>,
    private readonly knowledgeBasesService: KnowledgeBasesService,
  ) {}

  async createFromUpload(
    userId: string,
    knowledgeBaseId: string,
    file: UploadedDocumentFile | undefined,
  ): Promise<DocumentResponse> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const normalizedOriginalName = normalizeUploadedOriginalName(
      file.originalname,
    );

    if (!isAllowedDocumentFileType(file.mimetype, normalizedOriginalName)) {
      throw new BadRequestException('Invalid file type');
    }

    if (file.size > DOCUMENT_MAX_FILE_SIZE) {
      throw new BadRequestException('File too large');
    }

    const normalizedUserId = this.toObjectId(userId);
    const knowledgeBase = await this.knowledgeBasesService.findOneByUser(
      userId,
      knowledgeBaseId,
    );
    const normalizedKnowledgeBaseId = this.toObjectId(knowledgeBaseId);
    const storagePath = buildDocumentStoragePath(file.path);

    const createdDocument = new this.documentModel({
      userId: normalizedUserId,
      knowledgeBaseId: normalizedKnowledgeBaseId,
      filename: file.filename,
      originalName: normalizedOriginalName,
      mimeType: file.mimetype,
      size: file.size,
      storagePath,
      status: DocumentStatusEnum.Uploaded,
      activeChunkStrategyName: knowledgeBase.activeChunkStrategyName,
      activeChunkStrategyVersion: knowledgeBase.activeChunkStrategyVersion,
      activeChunkSize: knowledgeBase.activeChunkSize,
      activeChunkOverlap: knowledgeBase.activeChunkOverlap,
      activeChunkSplitterType: knowledgeBase.activeChunkSplitterType,
      activeChunkPreserveSentenceBoundary:
        knowledgeBase.activeChunkPreserveSentenceBoundary,
    });

    try {
      const savedDocument = await createdDocument.save();
      return this.toResponse(savedDocument);
    } catch {
      await removeStoredDocumentFile(storagePath);
      throw new InternalServerErrorException('Failed to save document');
    }
  }

  async findAllByUser(
    userId: string,
    knowledgeBaseId: string,
  ): Promise<DocumentResponse[]> {
    const normalizedUserId = this.toObjectId(userId);
    const normalizedKnowledgeBaseId = this.toObjectId(knowledgeBaseId);
    await this.knowledgeBasesService.assertOwnedKnowledgeBase(
      userId,
      knowledgeBaseId,
    );
    const documents = await this.documentModel
      .find({
        userId: normalizedUserId,
        knowledgeBaseId: normalizedKnowledgeBaseId,
      })
      .sort({ createdAt: -1 })
      .exec();

    return documents.map(
      (document): DocumentResponse => this.toResponse(document),
    );
  }

  async findOneByUser(
    userId: string,
    documentId: string,
  ): Promise<DocumentResponse> {
    const document = await this.findOwnedDocument(userId, documentId);
    return this.toResponse(document);
  }

  async remove(userId: string, documentId: string): Promise<void> {
    const normalizedUserId = this.toObjectId(userId);
    const normalizedDocumentId = this.toObjectId(documentId);

    const deletedDocument = await this.documentModel
      .findOneAndDelete({ _id: normalizedDocumentId, userId: normalizedUserId })
      .exec();

    if (!deletedDocument) {
      throw new NotFoundException('Document not found');
    }

    await Promise.all([
      this.chunkModel
        .deleteMany({
          userId: normalizedUserId,
          documentId: normalizedDocumentId,
        })
        .exec(),
      this.debugExperimentChunkModel
        .deleteMany({
          userId: normalizedUserId,
          documentId: normalizedDocumentId,
        })
        .exec(),
    ]);

    await removeStoredDocumentFile(deletedDocument.storagePath).catch(
      (error: Error) => {
        this.logger.warn(
          `Failed to remove stored file for document ${deletedDocument.id}: ${error.message}`,
        );
      },
    );
  }

  private async findOwnedDocument(
    userId: string,
    documentId: string,
  ): Promise<DocumentDocument> {
    const normalizedUserId = this.toObjectId(userId);
    const normalizedDocumentId = this.toObjectId(documentId);

    const document = await this.documentModel
      .findOne({ _id: normalizedDocumentId, userId: normalizedUserId })
      .exec();

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }
    return new Types.ObjectId(value);
  }

  private toResponse(document: DocumentDocument): DocumentResponse {
    return {
      id: document.id,
      userId: document.userId.toString(),
      knowledgeBaseId: document.knowledgeBaseId.toString(),
      filename: document.filename,
      originalName: document.originalName,
      mimeType: document.mimeType,
      size: document.size,
      status: document.status,
      summary: document.summary,
      errorMessage: document.errorMessage,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }
}
