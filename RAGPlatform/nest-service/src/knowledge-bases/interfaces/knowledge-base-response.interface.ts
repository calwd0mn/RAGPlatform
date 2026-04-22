export interface KnowledgeBaseResponse {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  activeChunkStrategyName?: string;
  activeChunkStrategyVersion?: string;
  activeChunkSize?: number;
  activeChunkOverlap?: number;
  activeChunkSplitterType?: 'recursive' | 'markdown' | 'token';
  activeChunkPreserveSentenceBoundary?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
