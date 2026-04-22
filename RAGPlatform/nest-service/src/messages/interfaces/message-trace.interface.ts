export interface MessageTrace {
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
  promptVersion?: string;
  latencyMs?: number;
}
