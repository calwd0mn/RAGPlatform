import { Embeddings } from '@langchain/core/embeddings';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Document } from '../../documents/schemas/document.schema';
import { IngestionEmbeddingsFactory } from '../../ingestion/embeddings/embeddings.factory';
import { Chunk } from '../../ingestion/schemas/chunk.schema';
import { ChunksService } from './chunks.service';

class StaticEmbeddings extends Embeddings {
  constructor(private readonly vector: number[]) {
    super({});
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return documents.map((): number[] => this.vector);
  }

  async embedQuery(_document: string): Promise<number[]> {
    return this.vector;
  }
}

interface TestChunkRow {
  id: string;
  documentId: Types.ObjectId;
  chunkIndex: number;
  content: string;
  embedding: number[];
  metadata?: {
    page?: number;
    originalName?: string;
    source?: string;
  };
}

describe('ChunksService', () => {
  let service: ChunksService;
  let chunkModelMock: {
    find: jest.Mock;
    countDocuments: jest.Mock;
  };
  let documentModelMock: {
    find: jest.Mock;
  };
  let embeddingsFactoryMock: {
    createEmbeddings: jest.Mock;
  };

  beforeEach(async () => {
    chunkModelMock = {
      find: jest.fn(),
      countDocuments: jest.fn(),
    };
    documentModelMock = {
      find: jest.fn(),
    };
    embeddingsFactoryMock = {
      createEmbeddings: jest.fn(() => new StaticEmbeddings([1, 0])),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChunksService,
        {
          provide: getModelToken(Chunk.name),
          useValue: chunkModelMock,
        },
        {
          provide: getModelToken(Document.name),
          useValue: documentModelMock,
        },
        {
          provide: IngestionEmbeddingsFactory,
          useValue: embeddingsFactoryMock,
        },
      ],
    }).compile();

    service = module.get<ChunksService>(ChunksService);
  });

  it('escapes regex keyword and calculates score when query exists', async () => {
    const documentId = new Types.ObjectId();
    const capturedQueries: Array<{
      userId: Types.ObjectId;
      documentId?: Types.ObjectId;
      'metadata.page'?: number;
      content?: { $regex: string; $options: string };
    }> = [];
    const rows: TestChunkRow[] = [
      {
        id: new Types.ObjectId().toString(),
        documentId,
        chunkIndex: 3,
        content: 'chunk content',
        embedding: [0.5, 0.5],
        metadata: {
          page: 7,
          originalName: 'manual.pdf',
        },
      },
    ];

    chunkModelMock.find.mockImplementation(
      (query: {
        userId: Types.ObjectId;
        documentId?: Types.ObjectId;
        'metadata.page'?: number;
        content?: { $regex: string; $options: string };
      }) => {
        capturedQueries.push(query);
        return {
          sort: jest.fn(() => ({
            skip: jest.fn(() => ({
              limit: jest.fn(() => ({
                select: jest.fn(() => ({
                  exec: jest.fn(async () => rows),
                })),
              })),
            })),
          })),
        };
      },
    );
    chunkModelMock.countDocuments.mockReturnValue({
      exec: jest.fn(async () => 1),
    });
    documentModelMock.find.mockReturnValue({
      select: jest.fn(() => ({
        exec: jest.fn(async () => [
          {
            id: documentId.toString(),
            originalName: 'manual.pdf',
          },
        ]),
      })),
    });

    const response = await service.findDebugChunks({
      userId: new Types.ObjectId().toString(),
      keyword: 'a+b',
      query: 'test query',
      limit: 10,
      offset: 0,
    });

    expect(capturedQueries).toHaveLength(1);
    expect(capturedQueries[0].content).toEqual({
      $regex: 'a\\+b',
      $options: 'i',
    });
    expect(response.items).toHaveLength(1);
    expect(response.items[0].score).toBeCloseTo(0.707106, 5);
  });

  it('keeps score undefined and skips embedding generation when query is absent', async () => {
    const documentId = new Types.ObjectId();
    const rows: TestChunkRow[] = [
      {
        id: new Types.ObjectId().toString(),
        documentId,
        chunkIndex: 0,
        content: 'another chunk',
        embedding: [0.1, 0.9],
        metadata: {
          page: 1,
          originalName: 'doc.pdf',
        },
      },
    ];

    chunkModelMock.find.mockReturnValue({
      sort: jest.fn(() => ({
        skip: jest.fn(() => ({
          limit: jest.fn(() => ({
            select: jest.fn(() => ({
              exec: jest.fn(async () => rows),
            })),
          })),
        })),
      })),
    });
    chunkModelMock.countDocuments.mockReturnValue({
      exec: jest.fn(async () => 1),
    });
    documentModelMock.find.mockReturnValue({
      select: jest.fn(() => ({
        exec: jest.fn(async () => [
          {
            id: documentId.toString(),
            originalName: 'doc.pdf',
          },
        ]),
      })),
    });

    const response = await service.findDebugChunks({
      userId: new Types.ObjectId().toString(),
      limit: 10,
      offset: 0,
    });

    expect(embeddingsFactoryMock.createEmbeddings).not.toHaveBeenCalled();
    expect(response.items[0].score).toBeUndefined();
  });
});
