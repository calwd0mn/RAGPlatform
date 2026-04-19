export interface RagTrace {
  knowledgeBaseId: string;
  query: string;
  rewrittenQuery?: string;
  topK: number;
  retrievedCount: number;
  model?: string;
  retrievalProvider?: string;
  promptVersion: string;
  latencyMs: number;
}
