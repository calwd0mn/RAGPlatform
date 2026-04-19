export interface KnowledgeBaseResponse {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  activeChunkStrategyName?: string;
  activeChunkStrategyVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}
