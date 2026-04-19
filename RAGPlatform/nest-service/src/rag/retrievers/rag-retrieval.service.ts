import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { RetrievedChunk } from '../interfaces/retrieved-chunk.interface';
import {
  RagRetrievalConfig,
  RagRetrievalProviderType,
  getRagRetrievalConfig,
} from './config/rag-retrieval.config';
import { RagRetrievalOutput } from './interfaces/rag-retrieval-output.interface';
import { AtlasVectorRetrievalProvider } from './providers/atlas-vector-retrieval.provider';
import { DebugExperimentRetrievalProvider } from './providers/debug-experiment-retrieval.provider';
import { LocalCosineRetrievalProvider } from './providers/local-cosine-retrieval.provider';

@Injectable()
export class RagRetrievalService {
  constructor(
    private readonly atlasVectorRetrievalProvider: AtlasVectorRetrievalProvider,
    private readonly localCosineRetrievalProvider: LocalCosineRetrievalProvider,
    private readonly debugExperimentRetrievalProvider: DebugExperimentRetrievalProvider,
  ) {}

  async retrieveTopKByUser(
    userId: string,
    knowledgeBaseId: string,
    queryEmbedding: number[],
    topK: number,
  ): Promise<RetrievedChunk[]> {
    const output = await this.retrieveTopKByUserWithProvider(
      userId,
      knowledgeBaseId,
      queryEmbedding,
      topK,
    );
    return output.chunks;
  }

  async retrieveTopKByUserWithProvider(
    userId: string,
    knowledgeBaseId: string,
    queryEmbedding: number[],
    topK: number,
  ): Promise<RagRetrievalOutput> {
    const config = getRagRetrievalConfig();
    if (config.provider === 'atlas') {
      return this.retrieveByAtlasWithPolicy(
        userId,
        knowledgeBaseId,
        queryEmbedding,
        topK,
        config,
      );
    }

    const chunks = await this.localCosineRetrievalProvider.retrieveTopKByUser(
      userId,
      knowledgeBaseId,
      queryEmbedding,
      topK,
    );
    return { chunks, provider: 'local' };
  }

  getConfiguredProvider(): RagRetrievalProviderType {
    return getRagRetrievalConfig().provider;
  }

  async retrieveTopKByNamespace(input: {
    userId: string;
    knowledgeBaseId: string;
    queryEmbedding: number[];
    topK: number;
    retrievalSource: 'production' | 'experiment';
    experimentId?: string;
    strategyName?: string;
  }): Promise<RagRetrievalOutput> {
    if (input.retrievalSource === 'experiment') {
      if (!input.experimentId || !input.strategyName) {
        throw new InternalServerErrorException(
          'Experiment retrieval requires experimentId and strategyName',
        );
      }

      const chunks =
        await this.debugExperimentRetrievalProvider.retrieveTopKByExperiment({
          userId: input.userId,
          knowledgeBaseId: input.knowledgeBaseId,
          experimentId: input.experimentId,
          strategyName: input.strategyName,
          queryEmbedding: input.queryEmbedding,
          topK: input.topK,
        });
      return { chunks, provider: 'debug-experiment-local' };
    }

    return this.retrieveTopKByUserWithProvider(
      input.userId,
      input.knowledgeBaseId,
      input.queryEmbedding,
      input.topK,
    );
  }

  private async retrieveByAtlasWithPolicy(
    userId: string,
    knowledgeBaseId: string,
    queryEmbedding: number[],
    topK: number,
    config: RagRetrievalConfig,
  ): Promise<RagRetrievalOutput> {
    try {
      const chunks = await this.atlasVectorRetrievalProvider.retrieveTopKByUser(
        userId,
        knowledgeBaseId,
        queryEmbedding,
        topK,
      );
      return { chunks, provider: 'atlas' };
    } catch (error) {
      if (this.shouldFallbackToLocal(config)) {
        const chunks = await this.localCosineRetrievalProvider.retrieveTopKByUser(
          userId,
          knowledgeBaseId,
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
