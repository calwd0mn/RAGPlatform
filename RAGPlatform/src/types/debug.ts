export interface RagPromptCurrentResponse {
  id: string;
  version: string;
  versionedId: string;
  systemPrompt: string;
  contextTemplate: string;
}

export type RetrievalSource = "production" | "experiment";

export interface PromptDraft {
  basePromptId: string;
  systemPrompt: string;
  contextTemplate: string;
  versionLabel?: string;
}

export interface ChunkStrategyDraft {
  name: string;
  type: "recursive" | "markdown" | "token";
  chunkSize: number;
  chunkOverlap: number;
  preserveSentenceBoundary: boolean;
  separators: string[];
  maxSentenceMerge?: number;
  versionLabel?: string;
}

export type DebugExperimentStatus =
  | "draft"
  | "running"
  | "completed"
  | "failed"
  | "published";

export interface DebugExperimentRecord {
  id: string;
  knowledgeBaseId: string;
  scope: "legacy" | "manual";
  documentIds?: string[];
  queries: string[];
  promptDraft: PromptDraft;
  chunkStrategyDrafts: ChunkStrategyDraft[];
  topK: number;
  mode: "retrieve-only" | "full-rag";
  status: DebugExperimentStatus;
  chunkNamespace: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DebugExperimentListResponse {
  items: DebugExperimentRecord[];
  limit: number;
  offset: number;
}

export interface DebugExperimentCreateRequest {
  knowledgeBaseId: string;
  scope?: "legacy" | "manual";
  documentIds?: string[];
  queries: string[];
  promptDraft: PromptDraft;
  chunkStrategyDrafts: ChunkStrategyDraft[];
  topK: number;
  mode: "retrieve-only" | "full-rag";
}

export interface DebugExperimentUpdateRequest {
  knowledgeBaseId?: string;
  documentIds?: string[];
  queries?: string[];
  promptDraft?: PromptDraft;
  chunkStrategyDrafts?: ChunkStrategyDraft[];
  topK?: number;
  mode?: "retrieve-only" | "full-rag";
}

export interface DebugExperimentRunResult {
  experimentId: string;
  status: DebugExperimentStatus;
  topK: number;
  mode: "retrieve-only" | "full-rag";
  promptSnapshot: PromptDraft;
  strategies: Array<{
    strategyName: string;
    retrievalNamespace: string;
    chunkCount: number;
    avgLength: number;
    results: Array<{
      query: string;
      retrievedCount: number;
      retrievalHits: RagDebugHit[];
      citationsCount: number;
      promptOutput: {
        messages: { role: string; content: string }[];
        promptText: string;
      };
      answerPreview?: string;
    }>;
  }>;
}

export interface PublishDebugExperimentRequest {
  strategyName?: string;
}

export interface PublishDebugExperimentResponse {
  experimentId: string;
  publishedStrategyName: string;
}

export interface RagDebugHit {
  chunkId: string;
  documentId: string;
  documentName: string;
  page?: number;
  chunkIndex?: number;
  score?: number;
  contentPreview: string;
}

export interface RagPromptRenderRequest {
  knowledgeBaseId: string;
  query: string;
  topK?: number;
  conversationId?: string;
}

export interface RagPromptRenderResponse {
  query: string;
  topK: number;
  promptVersion: string;
  retrievalProvider: string;
  retrievedCount: number;
  retrievalHits: RagDebugHit[];
  promptInput: {
    context: string;
    historyCount: number;
  };
  promptOutput: {
    messages: { role: string; content: string }[];
    promptText: string;
  };
  latencyMs: number;
}

export interface RagRetrieveDebugRequest {
  knowledgeBaseId: string;
  query: string;
  topK?: number;
}

export interface RagRetrieveDebugResponse {
  query: string;
  topK: number;
  promptVersion: string;
  retrievalProvider: string;
  retrievedCount: number;
  retrievalHits: RagDebugHit[];
  latencyMs: number;
}

export type RagRunType = "ask" | "debug-render" | "debug-retrieve";
export type RagRunStatus = "success" | "error";

export interface RagRunRecord {
  runId: string;
  runType: RagRunType;
  experimentId?: string;
  knowledgeBaseId?: string;
  query: string;
  promptVersion: string;
  topK?: number;
  retrievalProvider?: string;
  retrievalNamespace?: string;
  retrievalSource?: RetrievalSource;
  comparisonKey?: string;
  promptSnapshot?: PromptDraft;
  chunkStrategySnapshot?: ChunkStrategyDraft;
  retrievalHits: RagDebugHit[];
  latencyMs: number;
  status: RagRunStatus;
  errorCode?: string;
  createdAt: string;
}

export interface RagRunListResponse {
  items: RagRunRecord[];
  limit: number;
  offset: number;
}

export interface ChunksDebugItem {
  chunkId: string;
  documentId: string;
  documentName: string;
  page?: number;
  order: number;
  score?: number;
  contentPreview: string;
  retrievalSource: RetrievalSource;
  retrievalNamespace: string;
  strategyName?: string;
}

export interface ChunksDebugResponse {
  items: ChunksDebugItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ChunksDebugQuery {
  knowledgeBaseId: string;
  experimentId?: string;
  strategyName?: string;
  documentId?: string;
  keyword?: string;
  query?: string;
  page?: number;
  limit?: number;
  offset?: number;
}
