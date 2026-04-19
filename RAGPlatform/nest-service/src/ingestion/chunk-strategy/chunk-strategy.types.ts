import { RagRunRetrievalHit } from '../../schemas/rag-run.schema';

export const CHUNK_SPLITTER_TYPES = ['recursive', 'markdown', 'token'] as const;
export type ChunkSplitterType = (typeof CHUNK_SPLITTER_TYPES)[number];

export interface ChunkStrategyConfig {
  name: string;
  chunkSize: number;
  chunkOverlap: number;
  splitterType?: ChunkSplitterType;
  preserveSentenceBoundary?: boolean;
  separators?: string[];
  maxSentenceMerge?: number;
  versionLabel?: string;
}

export interface NormalizedChunkStrategyConfig {
  name: string;
  chunkSize: number;
  chunkOverlap: number;
  splitterType: ChunkSplitterType;
  preserveSentenceBoundary: boolean;
  separators: string[];
  maxSentenceMerge?: number;
  versionLabel?: string;
}

export const CHUNK_STRATEGY_TEST_MODES = ['retrieve-only', 'full-rag'] as const;
export type ChunkStrategyTestMode = (typeof CHUNK_STRATEGY_TEST_MODES)[number];

export interface ChunkStrategyQueryHit {
  query: string;
  retrievedCount: number;
  hits: RagRunRetrievalHit[];
  citationsCount: number;
  answerPreview?: string;
}

export interface ChunkStrategyTestStrategyReport {
  strategyName: string;
  splitterType: ChunkSplitterType;
  chunkSize: number;
  chunkOverlap: number;
  chunkCount: number;
  avgLength: number;
  retrievedCount: number;
  hits: ChunkStrategyQueryHit[];
  citationsCount: number;
  answerPreview?: string[];
}

export interface ChunkStrategyTestReport {
  testRunId: string;
  mode: ChunkStrategyTestMode;
  topK: number;
  documentIds: string[];
  queryCount: number;
  strategies: ChunkStrategyTestStrategyReport[];
}
