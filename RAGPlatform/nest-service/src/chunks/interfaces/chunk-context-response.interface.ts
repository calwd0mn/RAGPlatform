export interface ChunkContextItem {
  chunkId: string;
  documentId: string;
  documentName?: string;
  order: number;
  chunkIndex: number;
  content: string;
  contentPreview: string;
  page?: number;
}

export interface ChunkContextResponse {
  current: ChunkContextItem;
  previous: ChunkContextItem[];
  next: ChunkContextItem[];
}
