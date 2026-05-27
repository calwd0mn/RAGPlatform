export interface KnowledgeBaseRecord {
  id: string;
  name: string;
  isDefault: boolean;
  activeChunkStrategyName?: string;
  activeChunkStrategyVersion?: string;
  activeChunkSize?: number;
  activeChunkOverlap?: number;
  activeChunkSplitterType?: "recursive" | "markdown" | "token";
  activeChunkPreserveSentenceBoundary?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBaseOption {
  label: string;
  value: string;
}
