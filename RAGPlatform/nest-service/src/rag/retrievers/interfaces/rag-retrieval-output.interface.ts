import { RagRetrievalProviderType } from '../config/rag-retrieval.config';
import { RetrievedChunk } from '../../interfaces/retrieved-chunk.interface';

export interface RagRetrievalOutput {
  chunks: RetrievedChunk[];
  provider: RagRetrievalProviderType;
}
