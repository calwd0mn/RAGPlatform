import { Document as LangChainDocument } from '@langchain/core/documents';
import { InternalServerErrorException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { IngestionEmbeddingsFactory } from '../embeddings/embeddings.factory';
import { RetrievedChunk } from '../../rag/interfaces/retrieved-chunk.interface';
import { ChunkVectorDocumentMapper } from '../mappers/chunk-vector-document.mapper';
import { Chunk } from '../schemas/chunk.schema';
import { ChunkVectorStoreService } from './chunk-vector-store.service';

interface ChunkModelMock {
  collection: object;
  deleteMany: jest.Mock;
}

interface EmbeddingsFactoryMock {
  createEmbeddings: jest.Mock;
}

interface VectorStoreMock {
  addDocuments: jest.Mock;
  similaritySearchVectorWithScore: jest.Mock;
}

let mockVectorStore: VectorStoreMock;

jest.mock('@langchain/mongodb', () => ({
  MongoDBAtlasVectorSearch: jest.fn(() => mockVectorStore),
}));

describe('ChunkVectorStoreService', () => {
  const userId = new Types.ObjectId('507f191e810c19729de860ea');
  const knowledgeBaseId = new Types.ObjectId('507f191e810c19729de860ec');
  const documentId = new Types.ObjectId('507f1f77bcf86cd799439051');

  let service: ChunkVectorStoreService;
  let chunkModelMock: ChunkModelMock;
  let embeddingsFactoryMock: EmbeddingsFactoryMock;
  let mapperMock: {
    toVectorDocument: jest.Mock;
    toRetrievedChunk: jest.Mock;
  };
  let vectorStoreMock: VectorStoreMock;

  beforeEach(async () => {
    chunkModelMock = {
      collection: {},
      deleteMany: jest.fn(() => ({
        exec: jest.fn(async () => undefined),
      })),
    };
    embeddingsFactoryMock = {
      createEmbeddings: jest.fn(),
    };
    mapperMock = {
      toVectorDocument: jest.fn(),
      toRetrievedChunk: jest.fn(),
    };
    vectorStoreMock = {
      addDocuments: jest.fn(async () => undefined),
      similaritySearchVectorWithScore: jest.fn(),
    };
    mockVectorStore = vectorStoreMock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChunkVectorStoreService,
        {
          provide: getModelToken(Chunk.name),
          useValue: chunkModelMock,
        },
        {
          provide: IngestionEmbeddingsFactory,
          useValue: embeddingsFactoryMock,
        },
        {
          provide: ChunkVectorDocumentMapper,
          useValue: mapperMock,
        },
      ],
    }).compile();

    service = module.get<ChunkVectorStoreService>(ChunkVectorStoreService);
  });

  it('deletes existing chunks and adds mapped vector documents', async () => {
    const sourceDocuments = [
      new LangChainDocument({
        pageContent: 'first',
        metadata: { originalName: 'manual.pdf' },
      }),
      new LangChainDocument({
        pageContent: 'second',
        metadata: { page: 2 },
      }),
    ];
    const vectorDocuments = [
      new LangChainDocument({ pageContent: 'mapped first' }),
      new LangChainDocument({ pageContent: 'mapped second' }),
    ];
    mapperMock.toVectorDocument
      .mockReturnValueOnce(vectorDocuments[0])
      .mockReturnValueOnce(vectorDocuments[1]);

    const result = await service.replaceDocumentChunks({
      userId,
      knowledgeBaseId,
      documentId,
      chunks: sourceDocuments,
    });

    expect(chunkModelMock.deleteMany).toHaveBeenCalledWith({
      userId,
      documentId,
    });
    expect(mapperMock.toVectorDocument).toHaveBeenNthCalledWith(1, {
      chunkDocument: sourceDocuments[0],
      chunkIndex: 0,
      userId,
      knowledgeBaseId,
      documentId,
    });
    expect(mapperMock.toVectorDocument).toHaveBeenNthCalledWith(2, {
      chunkDocument: sourceDocuments[1],
      chunkIndex: 1,
      userId,
      knowledgeBaseId,
      documentId,
    });
    expect(vectorStoreMock.addDocuments).toHaveBeenCalledWith(vectorDocuments);
    expect(result).toBe(2);
  });

  it('maps vector search rows and filters null mapping results', async () => {
    const firstDocument = new LangChainDocument({ pageContent: 'first' });
    const secondDocument = new LangChainDocument({ pageContent: 'second' });
    const retrievedChunk: RetrievedChunk = {
      chunkId: '507f1f77bcf86cd799439041',
      documentId: documentId.toString(),
      chunkIndex: 0,
      content: 'first',
      score: 0.91,
      metadata: { originalName: 'manual.pdf' },
    };
    vectorStoreMock.similaritySearchVectorWithScore.mockResolvedValue([
      [firstDocument, 0.91],
      [secondDocument, 0.11],
    ]);
    mapperMock.toRetrievedChunk
      .mockReturnValueOnce(retrievedChunk)
      .mockReturnValueOnce(null);

    const result = await service.similaritySearchByVector({
      userId,
      knowledgeBaseId,
      queryEmbedding: [0.2, 0.4],
      topK: 2,
    });

    expect(
      vectorStoreMock.similaritySearchVectorWithScore,
    ).toHaveBeenCalledWith([0.2, 0.4], 2, {
      preFilter: {
        userId,
        knowledgeBaseId,
      },
    });
    expect(mapperMock.toRetrievedChunk).toHaveBeenNthCalledWith(1, {
      document: firstDocument,
      score: 0.91,
      userId,
      knowledgeBaseId,
    });
    expect(mapperMock.toRetrievedChunk).toHaveBeenNthCalledWith(2, {
      document: secondDocument,
      score: 0.11,
      userId,
      knowledgeBaseId,
    });
    expect(result).toEqual([retrievedChunk]);
  });

  it('rejects empty query embedding before vector search', async () => {
    await expect(
      service.similaritySearchByVector({
        userId,
        knowledgeBaseId,
        queryEmbedding: [],
        topK: 2,
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(
      vectorStoreMock.similaritySearchVectorWithScore,
    ).not.toHaveBeenCalled();
  });
});
