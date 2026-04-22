import { RetrievedChunk } from '../interfaces/retrieved-chunk.interface';
import { RagContextBuilder } from './rag-context.builder';

function createChunk(input: {
  chunkId: string;
  content: string;
  score?: number;
}): RetrievedChunk {
  return {
    chunkId: input.chunkId,
    documentId: '507f1f77bcf86cd799439051',
    chunkIndex: 0,
    content: input.content,
    score: input.score ?? 0.9,
    metadata: {
      page: 1,
      originalName: 'manual.pdf',
    },
  };
}

describe('RagContextBuilder', () => {
  const originalMaxChars = process.env.RAG_CONTEXT_MAX_CHARS;

  afterEach(() => {
    if (originalMaxChars === undefined) {
      delete process.env.RAG_CONTEXT_MAX_CHARS;
      return;
    }

    process.env.RAG_CONTEXT_MAX_CHARS = originalMaxChars;
  });

  it('returns empty context stats when no chunks are available', () => {
    const builder = new RagContextBuilder();

    const result = builder.build([]);

    expect(result.context).toBe('（无可用检索片段）');
    expect(result.contextChunkCount).toBe(0);
    expect(result.contextCharCount).toBe(result.context.length);
    expect(result.contextTrimmed).toBe(false);
  });

  it('trims context to the configured character budget', () => {
    process.env.RAG_CONTEXT_MAX_CHARS = '1000';
    const builder = new RagContextBuilder();

    const result = builder.build([
      createChunk({
        chunkId: '507f1f77bcf86cd799439041',
        content: 'a'.repeat(1500),
      }),
      createChunk({
        chunkId: '507f1f77bcf86cd799439042',
        content: 'b'.repeat(500),
      }),
    ]);

    expect(result.context.length).toBeLessThanOrEqual(1000);
    expect(result.contextChunkCount).toBe(1);
    expect(result.contextCharCount).toBe(result.context.length);
    expect(result.contextTrimmed).toBe(true);
    expect(result.context).toContain('[context trimmed]');
  });
});
