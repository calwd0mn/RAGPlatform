import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Embeddings } from '@langchain/core/embeddings';
import { OpenAIEmbeddings } from '@langchain/openai';
import { DeterministicEmbeddings } from './deterministic-embeddings';

const DEFAULT_OPENAI_EMBEDDINGS_BATCH_SIZE = 10;

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

    if (provider === 'openai') {
      const apiKey = (process.env.OPENAI_API_KEY ?? '').trim();
      const model = (
        process.env.INGESTION_EMBEDDINGS_MODEL ??
        process.env.RAG_EMBEDDING_MODEL ??
        ''
      ).trim();
      const baseUrl = (process.env.OPENAI_BASE_URL ?? '').trim();
      const rawBatchSize = (
        process.env.INGESTION_EMBEDDINGS_BATCH_SIZE ?? ''
      ).trim();
      const parsedBatchSize = Number.parseInt(rawBatchSize, 10);
      const batchSize =
        rawBatchSize.length > 0 && Number.isFinite(parsedBatchSize)
          ? parsedBatchSize
          : DEFAULT_OPENAI_EMBEDDINGS_BATCH_SIZE;

      if (apiKey.length === 0) {
        throw new InternalServerErrorException(
          'OPENAI_API_KEY is required when INGESTION_EMBEDDINGS_PROVIDER=openai',
        );
      }

      if (model.length === 0) {
        throw new InternalServerErrorException(
          'INGESTION_EMBEDDINGS_MODEL is required when INGESTION_EMBEDDINGS_PROVIDER=openai',
        );
      }

      if (batchSize < 1) {
        throw new InternalServerErrorException(
          'INGESTION_EMBEDDINGS_BATCH_SIZE must be a positive integer',
        );
      }

      return new OpenAIEmbeddings({
        apiKey,
        model,
        batchSize,
        configuration: baseUrl.length
          ? {
              baseURL: baseUrl,
            }
          : undefined,
      });
    }

    throw new InternalServerErrorException(
      `Unsupported ingestion embeddings provider: ${provider}`,
    );
  }
}
