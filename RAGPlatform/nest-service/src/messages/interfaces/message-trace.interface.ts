export interface MessageTrace {
  query?: string;
  rewrittenQuery?: string;
  topK?: number;
  model?: string;
  latencyMs?: number;
}
