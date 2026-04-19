import { Injectable } from '@nestjs/common';
import {
  ChunkStrategyQueryHit,
  ChunkStrategyTestReport,
  ChunkStrategyTestMode,
  ChunkStrategyTestStrategyReport,
  NormalizedChunkStrategyConfig,
} from './chunk-strategy.types';

@Injectable()
export class ChunkStrategyReporter {
  buildStrategyReport(input: {
    strategy: NormalizedChunkStrategyConfig;
    chunkCount: number;
    avgLength: number;
    queryHits: ChunkStrategyQueryHit[];
  }): ChunkStrategyTestStrategyReport {
    const retrievedCount = input.queryHits.reduce(
      (sum, item): number => sum + item.retrievedCount,
      0,
    );
    const citationsCount = input.queryHits.reduce(
      (sum, item): number => sum + item.citationsCount,
      0,
    );
    const answerPreviewList = input.queryHits
      .map((item): string | null => item.answerPreview ?? null)
      .filter((item): item is string => item !== null);

    return {
      strategyName: input.strategy.name,
      splitterType: input.strategy.splitterType,
      chunkSize: input.strategy.chunkSize,
      chunkOverlap: input.strategy.chunkOverlap,
      chunkCount: input.chunkCount,
      avgLength: Number(input.avgLength.toFixed(2)),
      retrievedCount,
      hits: input.queryHits,
      citationsCount,
      answerPreview: answerPreviewList.length > 0 ? answerPreviewList : undefined,
    };
  }

  buildTestReport(input: {
    testRunId: string;
    mode: ChunkStrategyTestMode;
    topK: number;
    documentIds: string[];
    queryCount: number;
    strategies: ChunkStrategyTestStrategyReport[];
  }): ChunkStrategyTestReport {
    return {
      testRunId: input.testRunId,
      mode: input.mode,
      topK: input.topK,
      documentIds: input.documentIds,
      queryCount: input.queryCount,
      strategies: input.strategies,
    };
  }
}
