import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Embeddings } from '@langchain/core/embeddings';
import { DeterministicEmbeddings } from './deterministic-embeddings';

@Injectable()
export class IngestionEmbeddingsFactory {
  createEmbeddings(): Embeddings {
    const provider = (
      process.env.INGESTION_EMBEDDINGS_PROVIDER ?? 'deterministic'
    )
      .trim()
      .toLowerCase();

    if (provider === 'deterministic') {
      return new DeterministicEmbeddings();
    }

    throw new InternalServerErrorException(
      `Unsupported ingestion embeddings provider: ${provider}`,
    );
  }
}
