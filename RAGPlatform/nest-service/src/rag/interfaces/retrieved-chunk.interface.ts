import { ChunkMetadata } from '../../ingestion/interfaces/chunk-metadata.interface';

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  content: string;
  score: number;
  metadata: ChunkMetadata;
}
