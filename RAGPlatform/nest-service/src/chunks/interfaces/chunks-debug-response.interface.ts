export interface ChunkDebugItem {
  chunkId: string;
  documentId: string;
  documentName: string;
  page?: number;
  order: number;
  score?: number;
  contentPreview: string;
  retrievalSource: 'production' | 'experiment';
  retrievalNamespace: string;
  strategyName?: string;
}

export interface ChunksDebugResponse {
  items: ChunkDebugItem[];
  total: number;
  limit: number;
  offset: number;
}
