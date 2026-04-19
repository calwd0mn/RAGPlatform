import { ChunkMetadata } from '../../ingestion/interfaces/chunk-metadata.interface';

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  chunkIndex?: number;
  content: string;
  score: number;
  metadata: ChunkMetadata;
}
