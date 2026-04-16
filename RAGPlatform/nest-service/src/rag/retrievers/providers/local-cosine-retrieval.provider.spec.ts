import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { LocalCosineRetrievalProvider } from './local-cosine-retrieval.provider';

interface QueryChain<T> {
  sort: () => {
    limit: () => {
      select: () => {
        lean: () => {
          exec: () => Promise<T>;
        };
      };
    };
  };
  select?: () => {
    lean: () => {
      exec: () => Promise<T>;
    };
  };
}

describe('LocalCosineRetrievalProvider', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns topK chunks sorted by cosine score and keeps userId isolation', async () => {
    process.env.RAG_VECTOR_CANDIDATE_LIMIT = '20';
    const ownerUserId = new Types.ObjectId('507f191e810c19729de860ea');

    const candidates = [
      {
        _id: new Types.ObjectId('507f1f77bcf86cd799439041'),
        documentId: new Types.ObjectId('507f1f77bcf86cd799439051'),
        embedding: [1, 0],
        metadata: { page: 1, originalName: 'a.pdf' },
      },
      {
        _id: new Types.ObjectId('507f1f77bcf86cd799439042'),
        documentId: new Types.ObjectId('507f1f77bcf86cd799439052'),
        embedding: [0.8, 0.2],
        metadata: { page: 2, originalName: 'b.pdf' },
      },
      {
        _id: new Types.ObjectId('507f1f77bcf86cd799439043'),
        documentId: new Types.ObjectId('507f1f77bcf86cd799439053'),
        embedding: [0, 0],
        metadata: { page: 3, originalName: 'c.pdf' },
      },
    ];
    const contentRows = [
      {
        _id: new Types.ObjectId('507f1f77bcf86cd799439041'),
        content: 'chunk-a',
      },
      {
        _id: new Types.ObjectId('507f1f77bcf86cd799439042'),
        content: 'chunk-b',
      },
    ];

    const findMock = jest.fn((filter: {
      userId?: Types.ObjectId;
      _id?: { $in: Types.ObjectId[] };
    }) => {
      if (filter._id) {
        return {
          select: () => ({
            lean: () => ({
              exec: async () => contentRows,
            }),
          }),
        };
      }

      return {
        sort: () => ({
          limit: () => ({
            select: () => ({
              lean: () => ({
                exec: async () => candidates,
              }),
            }),
          }),
        }),
      };
    });

    const provider = new LocalCosineRetrievalProvider({
      find: findMock,
    } as never);

    const result = await provider.retrieveTopKByUser(
      ownerUserId.toString(),
      [1, 0],
      2,
    );

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('chunk-a');
    expect(result[0].score).toBeGreaterThan(result[1].score);

    const firstFindFilter = findMock.mock.calls[0][0] as { userId: Types.ObjectId };
    expect(firstFindFilter.userId.toString()).toBe(ownerUserId.toString());

    const secondFindFilter = findMock.mock.calls[1][0] as {
      userId: Types.ObjectId;
      _id: { $in: Types.ObjectId[] };
    };
    expect(secondFindFilter.userId.toString()).toBe(ownerUserId.toString());
    expect(secondFindFilter._id.$in).toHaveLength(2);
  });

  it('throws bad request on invalid user id', async () => {
    const provider = new LocalCosineRetrievalProvider({
      find: jest.fn((): QueryChain<[]> => ({
        sort: () => ({
          limit: () => ({
            select: () => ({
              lean: () => ({
                exec: async () => [],
              }),
            }),
          }),
        }),
      })),
    } as never);

    await expect(
      provider.retrieveTopKByUser('invalid-id', [0.1, 0.2], 3),
    ).rejects.toThrow(BadRequestException);
  });
});
