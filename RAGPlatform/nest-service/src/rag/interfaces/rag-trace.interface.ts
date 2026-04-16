export interface RagTrace {
  query: string;
  rewrittenQuery?: string;
  topK: number;
  retrievedCount: number;
  model?: string;
  retrievalProvider?: string;
  latencyMs: number;
}
