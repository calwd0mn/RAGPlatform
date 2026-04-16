import { RetrievedChunk } from '../../interfaces/retrieved-chunk.interface';

export interface RagRetrievalProvider {
  readonly name: string;
  retrieveTopKByUser(
    userId: string,
    queryEmbedding: number[],
    topK: number,
  ): Promise<RetrievedChunk[]>;
}
