import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { AtlasVectorRetrievalProvider } from './atlas-vector-retrieval.provider';

interface AggregateChain<T> {
  exec: () => Promise<T>;
}

describe('AtlasVectorRetrievalProvider', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('maps atlas result to unified retrieved chunks and enforces user isolation', async () => {
    process.env.RAG_VECTOR_INDEX_NAME = 'chunk_vector_index';
    process.env.RAG_VECTOR_PATH = 'embedding';
    process.env.RAG_VECTOR_CANDIDATE_LIMIT = '50';

    const ownerUserId = new Types.ObjectId('507f191e810c19729de860ea');
    const otherUserId = new Types.ObjectId('507f191e810c19729de860eb');
    type PipelineStage = {
      $vectorSearch?: {
        filter?: {
          userId: Types.ObjectId;
        };
        limit?: number;
      };
    };
    const aggregateMock = jest.fn(
      (_pipeline: PipelineStage[]): AggregateChain<
        Array<{
          _id: Types.ObjectId;
          userId: Types.ObjectId;
          documentId: Types.ObjectId;
          content: string;
          metadata: { page: number; originalName: string };
          score: number;
        }>
      > => ({
        exec: async () => [
          {
            _id: new Types.ObjectId('507f1f77bcf86cd799439041'),
            userId: ownerUserId,
            documentId: new Types.ObjectId('507f1f77bcf86cd799439051'),
            content: 'owner chunk',
            metadata: { page: 1, originalName: 'owner.pdf' },
            score: 0.96,
          },
          {
            _id: new Types.ObjectId('507f1f77bcf86cd799439042'),
            userId: otherUserId,
            documentId: new Types.ObjectId('507f1f77bcf86cd799439052'),
            content: 'other chunk',
            metadata: { page: 2, originalName: 'other.pdf' },
            score: 0.99,
          },
        ],
      }),
    );
    const provider = new AtlasVectorRetrievalProvider({
      aggregate: aggregateMock,
    } as never);

    const result = await provider.retrieveTopKByUser(
      ownerUserId.toString(),
      [0.1, 0.2, 0.3],
      5,
    );

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('owner chunk');
    expect(result[0].documentId).toBe('507f1f77bcf86cd799439051');
    const pipeline = aggregateMock.mock.calls[0][0] as PipelineStage[];
    expect(pipeline[0].$vectorSearch?.filter?.userId.toString()).toBe(
      ownerUserId.toString(),
    );
    expect(pipeline[0].$vectorSearch?.limit).toBe(5);
  });

  it('throws explicit error when atlas aggregation fails', async () => {
    process.env.RAG_VECTOR_INDEX_NAME = 'chunk_vector_index';
    process.env.RAG_VECTOR_PATH = 'embedding';

    const provider = new AtlasVectorRetrievalProvider({
      aggregate: jest.fn((): AggregateChain<[]> => ({
        exec: async () => {
          throw new Error('aggregate failed');
        },
      })),
    } as never);

    await expect(
      provider.retrieveTopKByUser('507f191e810c19729de860ea', [0.1, 0.2], 5),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws explicit error when atlas payload structure is invalid', async () => {
    process.env.RAG_VECTOR_INDEX_NAME = 'chunk_vector_index';
    process.env.RAG_VECTOR_PATH = 'embedding';

    const provider = new AtlasVectorRetrievalProvider({
      aggregate: jest.fn((): AggregateChain<Array<{ userId: Types.ObjectId }>> => ({
        exec: async () => [
          {
            userId: new Types.ObjectId('507f191e810c19729de860ea'),
          },
        ],
      })),
    } as never);

    await expect(
      provider.retrieveTopKByUser('507f191e810c19729de860ea', [0.1, 0.2], 5),
    ).rejects.toThrow('Atlas provider returned invalid payload');
  });

  it('throws bad request on invalid user id', async () => {
    process.env.RAG_VECTOR_INDEX_NAME = 'chunk_vector_index';
    process.env.RAG_VECTOR_PATH = 'embedding';

    const provider = new AtlasVectorRetrievalProvider({
      aggregate: jest.fn((): AggregateChain<[]> => ({ exec: async () => [] })),
    } as never);

    await expect(
      provider.retrieveTopKByUser('invalid-id', [0.1, 0.2], 5),
    ).rejects.toThrow(BadRequestException);
  });
});
