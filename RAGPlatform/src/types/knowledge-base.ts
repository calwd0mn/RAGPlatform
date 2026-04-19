export interface KnowledgeBaseRecord {
  id: string;
  name: string;
  isDefault: boolean;
  activeChunkStrategyName?: string;
  activeChunkStrategyVersion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBaseOption {
  label: string;
  value: string;
}
