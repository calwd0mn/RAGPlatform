import { InternalServerErrorException } from '@nestjs/common';
import { getRagRetrievalConfig } from './rag-retrieval.config';

describe('getRagRetrievalConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('throws when atlas provider misses index name', () => {
    process.env.RAG_RETRIEVAL_PROVIDER = 'atlas';
    delete process.env.RAG_VECTOR_INDEX_NAME;
    process.env.RAG_VECTOR_PATH = 'embedding';

    expect(() => getRagRetrievalConfig()).toThrow(InternalServerErrorException);
    expect(() => getRagRetrievalConfig()).toThrow(
      'RAG_VECTOR_INDEX_NAME is required when RAG_RETRIEVAL_PROVIDER=atlas',
    );
  });

  it('throws when atlas provider misses vector path', () => {
    process.env.RAG_RETRIEVAL_PROVIDER = 'atlas';
    process.env.RAG_VECTOR_INDEX_NAME = 'chunk_vector_index';
    delete process.env.RAG_VECTOR_PATH;

    expect(() => getRagRetrievalConfig()).toThrow(InternalServerErrorException);
    expect(() => getRagRetrievalConfig()).toThrow(
      'RAG_VECTOR_PATH is required when RAG_RETRIEVAL_PROVIDER=atlas',
    );
  });

  it('returns defaults when local provider is selected', () => {
    process.env.RAG_RETRIEVAL_PROVIDER = 'local';
    delete process.env.RAG_VECTOR_INDEX_NAME;
    delete process.env.RAG_VECTOR_PATH;

    const result = getRagRetrievalConfig();
    expect(result.provider).toBe('local');
    expect(result.vectorIndexName).toBe('chunk_vector_index');
    expect(result.vectorPath).toBe('embedding');
  });
});
