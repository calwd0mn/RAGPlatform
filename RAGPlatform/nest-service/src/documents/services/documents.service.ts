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
import {
  buildDocumentStoragePath,
  isAllowedDocumentFileType,
  removeStoredDocumentFile,
} from '../utils/document-file.util';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectModel(Document.name)
    private readonly documentModel: Model<DocumentDocument>,
  ) {}

  async createFromUpload(
    userId: string,
    file: UploadedDocumentFile | undefined,
  ): Promise<DocumentResponse> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!isAllowedDocumentFileType(file.mimetype, file.originalname)) {
      throw new BadRequestException('Invalid file type');
    }

    if (file.size > DOCUMENT_MAX_FILE_SIZE) {
      throw new BadRequestException('File too large');
    }

    const normalizedUserId = this.toObjectId(userId);
    const storagePath = buildDocumentStoragePath(file.path);

    const createdDocument = new this.documentModel({
      userId: normalizedUserId,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storagePath,
      status: DocumentStatusEnum.Uploaded,
    });

    try {
      const savedDocument = await createdDocument.save();
      return this.toResponse(savedDocument);
    } catch {
      await removeStoredDocumentFile(storagePath);
      throw new InternalServerErrorException('Failed to save document');
    }
  }

  async findAllByUser(userId: string): Promise<DocumentResponse[]> {
    const normalizedUserId = this.toObjectId(userId);
    const documents = await this.documentModel
      .find({ userId: normalizedUserId })
      .sort({ createdAt: -1 })
      .exec();

    return documents.map((document): DocumentResponse => this.toResponse(document));
  }

  async findOneByUser(userId: string, documentId: string): Promise<DocumentResponse> {
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

    await removeStoredDocumentFile(deletedDocument.storagePath).catch((error: Error) => {
      this.logger.warn(
        `Failed to remove stored file for document ${deletedDocument.id}: ${error.message}`,
      );
    });
  }

  private async findOwnedDocument(userId: string, documentId: string): Promise<DocumentDocument> {
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
