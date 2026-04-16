import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { DOCUMENT_MAX_FILE_SIZE } from './constants/document.constants';
import { DocumentsService } from './documents.service';
import { UploadedDocumentFile } from './interfaces/uploaded-document-file.interface';
import { DocumentStatusEnum } from './interfaces/document-status.type';
import { Document } from './schemas/document.schema';
import * as documentFileUtil from './utils/document-file.util';

function createDocumentDoc(input?: {
  id?: string;
  userId?: string;
  filename?: string;
  originalName?: string;
  storagePath?: string;
  status?: DocumentStatusEnum;
}): {
  id: string;
  userId: Types.ObjectId;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  status: DocumentStatusEnum;
  createdAt: Date;
  updatedAt: Date;
  summary?: string;
  errorMessage?: string;
} {
  const baseTime = new Date('2026-04-16T00:00:00.000Z');
  return {
    id: input?.id ?? '507f1f77bcf86cd799439111',
    userId: new Types.ObjectId(input?.userId ?? '507f191e810c19729de860ea'),
    filename: input?.filename ?? 'file-1.txt',
    originalName: input?.originalName ?? 'source.txt',
    mimeType: 'text/plain',
    size: 100,
    storagePath: input?.storagePath ?? 'uploads/documents/file-1.txt',
    status: input?.status ?? DocumentStatusEnum.Uploaded,
    createdAt: baseTime,
    updatedAt: baseTime,
    summary: undefined,
    errorMessage: undefined,
  };
}

function createExecQuery<T>(value: T): { exec: () => Promise<T> } {
  return {
    exec: async (): Promise<T> => value,
  };
}

function createUploadFile(input?: {
  originalname?: string;
  mimetype?: string;
  size?: number;
  filename?: string;
  path?: string;
}): UploadedDocumentFile {
  return {
    fieldname: 'file',
    originalname: input?.originalname ?? 'source.txt',
    encoding: '7bit',
    mimetype: input?.mimetype ?? 'text/plain',
    size: input?.size ?? 10,
    destination: 'uploads/documents',
    filename: input?.filename ?? 'saved.txt',
    path: input?.path ?? 'uploads/documents/saved.txt',
    buffer: Buffer.from('hello'),
  };
}

describe('DocumentsService', () => {
  let service: DocumentsService;
  let modelMock: jest.Mock & {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneAndDelete: jest.Mock;
  };

  beforeEach(async () => {
    const constructorMock = jest.fn(function mockModel(
      this: { save: jest.Mock },
      params: {
        userId: Types.ObjectId;
        filename: string;
        originalName: string;
        mimeType: string;
        size: number;
        storagePath: string;
        status: DocumentStatusEnum;
      },
    ) {
      this.save = jest.fn(async () =>
        createDocumentDoc({
          userId: params.userId.toString(),
          filename: params.filename,
          originalName: params.originalName,
          storagePath: params.storagePath,
          status: params.status,
        }),
      );
    });

    modelMock = Object.assign(constructorMock, {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndDelete: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: getModelToken(Document.name),
          useValue: modelMock,
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates document metadata with uploaded status', async () => {
    const file = createUploadFile();
    const result = await service.createFromUpload('507f191e810c19729de860ea', file);

    expect(result.status).toBe(DocumentStatusEnum.Uploaded);
    expect(result.originalName).toBe('source.txt');
  });

  it('rejects unsupported file type', async () => {
    const file = createUploadFile({ originalname: 'source.exe', mimetype: 'application/octet-stream' });

    await expect(service.createFromUpload('507f191e810c19729de860ea', file)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects oversized file', async () => {
    const file = createUploadFile({ size: DOCUMENT_MAX_FILE_SIZE + 1 });

    await expect(service.createFromUpload('507f191e810c19729de860ea', file)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('lists only queried user documents with createdAt desc sort', async () => {
    const docs = [createDocumentDoc(), createDocumentDoc({ id: '507f1f77bcf86cd799439112' })];
    const sortMock = jest.fn(() => createExecQuery(docs));
    modelMock.find.mockReturnValue({ sort: sortMock });

    const result = await service.findAllByUser('507f191e810c19729de860ea');

    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
    expect(result).toHaveLength(2);
  });

  it('returns not found when reading a non-owned document', async () => {
    modelMock.findOne.mockReturnValue(createExecQuery(null));

    await expect(
      service.findOneByUser('507f191e810c19729de860ea', '507f1f77bcf86cd799439111'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes document record even when file is missing', async () => {
    modelMock.findOneAndDelete.mockReturnValue(createExecQuery(createDocumentDoc()));
    const removeFileSpy = jest
      .spyOn(documentFileUtil, 'removeStoredDocumentFile')
      .mockResolvedValue(undefined);

    await expect(
      service.remove('507f191e810c19729de860ea', '507f1f77bcf86cd799439111'),
    ).resolves.toBeUndefined();

    expect(removeFileSpy).toHaveBeenCalled();
  });

  it('returns not found when deleting non-owned document', async () => {
    modelMock.findOneAndDelete.mockReturnValue(createExecQuery(null));

    await expect(
      service.remove('507f191e810c19729de860ea', '507f1f77bcf86cd799439111'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
