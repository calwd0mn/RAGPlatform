import { Embeddings } from '@langchain/core/embeddings';
import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IngestionEmbeddingsFactory } from '../../ingestion/embeddings/embeddings.factory';
import { RetrievedChunk } from '../interfaces/retrieved-chunk.interface';
import { AtlasVectorRetrievalProvider } from './providers/atlas-vector-retrieval.provider';
import { LocalCosineRetrievalProvider } from './providers/local-cosine-retrieval.provider';
import { RagRetrievalService } from './rag-retrieval.service';

const SAMPLE_CHUNKS: RetrievedChunk[] = [
  {
    chunkId: '507f1f77bcf86cd799439041',
    documentId: '507f1f77bcf86cd799439051',
    content: 'chunk',
    score: 0.98,
    metadata: {
      page: 1,
      originalName: 'sample.pdf',
    },
  },
];

class StaticEmbeddings extends Embeddings {
  constructor(private readonly value: number[]) {
    super({});
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return documents.map((): number[] => this.value);
  }

  async embedQuery(_document: string): Promise<number[]> {
    return this.value;
  }
}

class FailingEmbeddings extends Embeddings {
  constructor() {
    super({});
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return documents.map((): number[] => []);
  }

  async embedQuery(_document: string): Promise<number[]> {
    throw new Error('embedding failed');
  }
}

describe('RagRetrievalService', () => {
  let service: RagRetrievalService;
  let atlasProviderMock: {
    retrieveTopKByUser: jest.Mock;
  };
  let localProviderMock: {
    retrieveTopKByUser: jest.Mock;
  };
  let embeddingsFactoryMock: {
    createEmbeddings: jest.Mock;
  };

  const originalEnv = { ...process.env };
  const userId = '507f191e810c19729de860ea';
  const knowledgeBaseId = '507f191e810c19729de860ec';

  beforeEach(async () => {
    process.env = { ...originalEnv };
    atlasProviderMock = {
      retrieveTopKByUser: jest.fn(),
    };
    localProviderMock = {
      retrieveTopKByUser: jest.fn(),
    };
    embeddingsFactoryMock = {
      createEmbeddings: jest.fn(() => new StaticEmbeddings([0.2, 0.4])),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagRetrievalService,
        {
          provide: AtlasVectorRetrievalProvider,
          useValue: atlasProviderMock,
        },
        {
          provide: LocalCosineRetrievalProvider,
          useValue: localProviderMock,
        },
        {
          provide: IngestionEmbeddingsFactory,
          useValue: embeddingsFactoryMock,
        },
      ],
    }).compile();

    service = module.get<RagRetrievalService>(RagRetrievalService);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('selects atlas provider when RAG_RETRIEVAL_PROVIDER=atlas', async () => {
    process.env.RAG_RETRIEVAL_PROVIDER = 'atlas';
    process.env.RAG_VECTOR_INDEX_NAME = 'chunk_vector_index';
    process.env.RAG_VECTOR_PATH = 'embedding';
    atlasProviderMock.retrieveTopKByUser.mockResolvedValue(SAMPLE_CHUNKS);

    const result = await service.retrieveTopKByUser(
      userId,
      knowledgeBaseId,
      [0.2, 0.4],
      3,
    );
    const output = await service.retrieveTopKByUserWithProvider(
      userId,
      knowledgeBaseId,
      [0.2, 0.4],
      3,
    );

    expect(atlasProviderMock.retrieveTopKByUser).toHaveBeenCalledTimes(2);
    expect(localProviderMock.retrieveTopKByUser).not.toHaveBeenCalled();
    expect(result).toEqual(SAMPLE_CHUNKS);
    expect(output.provider).toBe('atlas');
  });

  it('embeds query before selecting the configured provider', async () => {
    process.env.RAG_RETRIEVAL_PROVIDER = 'local';
    localProviderMock.retrieveTopKByUser.mockResolvedValue(SAMPLE_CHUNKS);

    const output = await service.retrieveTopKByQueryWithProvider({
      userId,
      knowledgeBaseId,
      query: '什么是RAG?',
      topK: 3,
    });

    expect(embeddingsFactoryMock.createEmbeddings).toHaveBeenCalledTimes(1);
    expect(localProviderMock.retrieveTopKByUser).toHaveBeenCalledWith(
      userId,
      knowledgeBaseId,
      [0.2, 0.4],
      3,
    );
    expect(output.chunks).toEqual(SAMPLE_CHUNKS);
    expect(output.provider).toBe('local');
  });

  it('throws explicit error when query embedding fails', async () => {
    embeddingsFactoryMock.createEmbeddings.mockReturnValue(
      new FailingEmbeddings(),
    );

    await expect(
      service.retrieveTopKByQueryWithProvider({
        userId,
        knowledgeBaseId,
        query: 'hello',
        topK: 3,
      }),
    ).rejects.toThrow('Failed to generate query embedding');

    expect(localProviderMock.retrieveTopKByUser).not.toHaveBeenCalled();
    expect(atlasProviderMock.retrieveTopKByUser).not.toHaveBeenCalled();
  });

  it('selects local provider when RAG_RETRIEVAL_PROVIDER=local', async () => {
    process.env.RAG_RETRIEVAL_PROVIDER = 'local';
    localProviderMock.retrieveTopKByUser.mockResolvedValue(SAMPLE_CHUNKS);

    const result = await service.retrieveTopKByUser(
      userId,
      knowledgeBaseId,
      [0.2, 0.4],
      3,
    );

    expect(localProviderMock.retrieveTopKByUser).toHaveBeenCalledTimes(1);
    expect(atlasProviderMock.retrieveTopKByUser).not.toHaveBeenCalled();
    expect(result).toEqual(SAMPLE_CHUNKS);
  });

  it('throws explicit error when provider config is invalid', async () => {
    process.env.RAG_RETRIEVAL_PROVIDER = 'invalid-provider';

    await expect(
      service.retrieveTopKByUser(userId, knowledgeBaseId, [0.2, 0.4], 3),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws explicit error when atlas fails and fallback is disabled', async () => {
    process.env.RAG_RETRIEVAL_PROVIDER = 'atlas';
    process.env.RAG_VECTOR_INDEX_NAME = 'chunk_vector_index';
    process.env.RAG_VECTOR_PATH = 'embedding';
    atlasProviderMock.retrieveTopKByUser.mockRejectedValue(
      new Error('atlas down'),
    );

    await expect(
      service.retrieveTopKByUser(userId, knowledgeBaseId, [0.2, 0.4], 3),
    ).rejects.toThrow(InternalServerErrorException);

    expect(localProviderMock.retrieveTopKByUser).not.toHaveBeenCalled();
  });

  it('falls back to local when atlas fails and fallback is explicitly enabled', async () => {
    process.env.RAG_RETRIEVAL_PROVIDER = 'atlas';
    process.env.RAG_VECTOR_INDEX_NAME = 'chunk_vector_index';
    process.env.RAG_VECTOR_PATH = 'embedding';
    process.env.RAG_RETRIEVAL_ALLOW_FALLBACK_TO_LOCAL = 'true';
    process.env.NODE_ENV = 'development';
    atlasProviderMock.retrieveTopKByUser.mockRejectedValue(
      new Error('atlas down'),
    );
    localProviderMock.retrieveTopKByUser.mockResolvedValue(SAMPLE_CHUNKS);

    const output = await service.retrieveTopKByUserWithProvider(
      userId,
      knowledgeBaseId,
      [0.2, 0.4],
      3,
    );

    expect(atlasProviderMock.retrieveTopKByUser).toHaveBeenCalledTimes(1);
    expect(localProviderMock.retrieveTopKByUser).toHaveBeenCalledTimes(1);
    expect(output.chunks).toEqual(SAMPLE_CHUNKS);
    expect(output.provider).toBe('local');
  });
});
