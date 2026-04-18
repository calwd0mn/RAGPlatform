export interface ChunkContextItem {
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  page?: number;
}

export interface ChunkContextResponse {
  current: ChunkContextItem;
  previous: ChunkContextItem[];
  next: ChunkContextItem[];
}

