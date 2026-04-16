import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { RetrievedChunk } from '../interfaces/retrieved-chunk.interface';
import {
  RagRetrievalConfig,
  RagRetrievalProviderType,
  getRagRetrievalConfig,
} from './config/rag-retrieval.config';
import { RagRetrievalOutput } from './interfaces/rag-retrieval-output.interface';
import { AtlasVectorRetrievalProvider } from './providers/atlas-vector-retrieval.provider';
import { LocalCosineRetrievalProvider } from './providers/local-cosine-retrieval.provider';

@Injectable()
export class RagRetrievalService {
  constructor(
    private readonly atlasVectorRetrievalProvider: AtlasVectorRetrievalProvider,
    private readonly localCosineRetrievalProvider: LocalCosineRetrievalProvider,
  ) {}

  async retrieveTopKByUser(
    userId: string,
    queryEmbedding: number[],
    topK: number,
  ): Promise<RetrievedChunk[]> {
    const output = await this.retrieveTopKByUserWithProvider(
      userId,
      queryEmbedding,
      topK,
    );
    return output.chunks;
  }

  async retrieveTopKByUserWithProvider(
    userId: string,
    queryEmbedding: number[],
    topK: number,
  ): Promise<RagRetrievalOutput> {
    const config = getRagRetrievalConfig();
    if (config.provider === 'atlas') {
      return this.retrieveByAtlasWithPolicy(userId, queryEmbedding, topK, config);
    }

    const chunks = await this.localCosineRetrievalProvider.retrieveTopKByUser(
      userId,
      queryEmbedding,
      topK,
    );
    return { chunks, provider: 'local' };
  }

  getConfiguredProvider(): RagRetrievalProviderType {
    return getRagRetrievalConfig().provider;
  }

  private async retrieveByAtlasWithPolicy(
    userId: string,
    queryEmbedding: number[],
    topK: number,
    config: RagRetrievalConfig,
  ): Promise<RagRetrievalOutput> {
    try {
      const chunks = await this.atlasVectorRetrievalProvider.retrieveTopKByUser(
        userId,
        queryEmbedding,
        topK,
      );
      return { chunks, provider: 'atlas' };
    } catch (error) {
      if (this.shouldFallbackToLocal(config)) {
        const chunks = await this.localCosineRetrievalProvider.retrieveTopKByUser(
          userId,
          queryEmbedding,
          topK,
        );
        return { chunks, provider: 'local' };
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(
          `Atlas retrieval is unavailable: ${error.message}`,
        );
      }

      throw new InternalServerErrorException('Atlas retrieval is unavailable');
    }
  }

  private shouldFallbackToLocal(config: RagRetrievalConfig): boolean {
    if (!config.allowLocalFallback) {
      return false;
    }

    if (config.nodeEnv === 'production') {
      return false;
    }

    return true;
  }
}
