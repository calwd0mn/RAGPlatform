import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { RetrievedChunk } from '../../interfaces/retrieved-chunk.interface';
import { AtlasVectorRetrievalProvider } from './atlas-vector-retrieval.provider';

describe('AtlasVectorRetrievalProvider', () => {
  const ownerUserId = new Types.ObjectId('507f191e810c19729de860ea');
  const knowledgeBaseId = new Types.ObjectId('507f191e810c19729de860ec');
  const chunks: RetrievedChunk[] = [
    {
      chunkId: '507f1f77bcf86cd799439041',
      documentId: '507f1f77bcf86cd799439051',
      content: 'owner chunk',
      metadata: { page: 1, originalName: 'owner.pdf' },
      score: 0.96,
    },
  ];

  it('delegates atlas vector search to the LangChain vector store service', async () => {
    const vectorStoreMock = {
      replaceDocumentChunks: jest.fn(async (): Promise<number> => 0),
      similaritySearchByVector: jest.fn(async (): Promise<RetrievedChunk[]> => chunks),
    };
    const provider = new AtlasVectorRetrievalProvider(vectorStoreMock as never);

    const result = await provider.retrieveTopKByUser(
      ownerUserId.toString(),
      knowledgeBaseId.toString(),
      [0.1, 0.2, 0.3],
      5,
    );

    expect(result).toEqual(chunks);
    expect(vectorStoreMock.similaritySearchByVector).toHaveBeenCalledWith({
      userId: ownerUserId,
      knowledgeBaseId,
      queryEmbedding: [0.1, 0.2, 0.3],
      topK: 5,
    });
  });

  it('keeps vector store failures explicit', async () => {
    const vectorStoreMock = {
      replaceDocumentChunks: jest.fn(async (): Promise<number> => 0),
      similaritySearchByVector: jest.fn(async (): Promise<RetrievedChunk[]> => {
        throw new InternalServerErrorException('Atlas vector retrieval failed');
      }),
    };
    const provider = new AtlasVectorRetrievalProvider(vectorStoreMock as never);

    await expect(
      provider.retrieveTopKByUser(
        ownerUserId.toString(),
        knowledgeBaseId.toString(),
        [0.1, 0.2],
        5,
      ),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws bad request on invalid ids', async () => {
    const vectorStoreMock = {
      replaceDocumentChunks: jest.fn(async (): Promise<number> => 0),
      similaritySearchByVector: jest.fn(async (): Promise<RetrievedChunk[]> => []),
    };
    const provider = new AtlasVectorRetrievalProvider(vectorStoreMock as never);

    await expect(
      provider.retrieveTopKByUser('invalid-id', knowledgeBaseId.toString(), [0.1], 5),
    ).rejects.toThrow(BadRequestException);

    await expect(
      provider.retrieveTopKByUser(ownerUserId.toString(), 'invalid-id', [0.1], 5),
    ).rejects.toThrow(BadRequestException);
  });
});
