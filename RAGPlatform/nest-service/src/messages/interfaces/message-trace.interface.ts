export interface MessageTrace {
  query?: string;
  rewrittenQuery?: string;
  topK?: number;
  retrievedCount?: number;
  model?: string;
  retrievalProvider?: string;
  latencyMs?: number;
}
