import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
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

describe('RagRetrievalService', () => {
  let service: RagRetrievalService;
  let atlasProviderMock: {
    retrieveTopKByUser: jest.Mock;
  };
  let localProviderMock: {
    retrieveTopKByUser: jest.Mock;
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
