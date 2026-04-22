export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface RagCitation {
  id?: string;
  documentName?: string;
  content?: string;
  score?: number;
  documentId?: string;
  chunkId?: string;
  page?: number;
}

export interface RagTraceStep {
  id?: string;
  step: string;
  detail?: string;
  elapsedMs?: number;
  status?: string;
  metadata?: Record<string, JsonValue>;
}

export interface RagTrace {
  knowledgeBaseId?: string;
  query?: string;
  rewrittenQuery?: string;
  topK?: number;
  retrievedCount?: number;
  contextChunkCount?: number;
  contextCharCount?: number;
  contextTrimmed?: boolean;
  model?: string;
  retrievalProvider?: string;
  latencyMs?: number;
}

export interface RagAskRequest {
  conversationId: string;
  query: string;
  topK?: number;
}

export interface RagAskResponse {
  answer: string;
  citations: RagCitation[];
  trace: RagTrace;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
}
