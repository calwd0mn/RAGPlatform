import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Document, DocumentSchema } from '../documents/schemas/document.schema';
import { ChunkMetadataBuilder } from './builders/chunk-metadata.builder';
import { ChunkStrategyReporter } from './chunk-strategy/chunk-strategy.reporter';
import { ChunkStrategyRunner } from './chunk-strategy/chunk-strategy.runner';
import {
  ChunkStrategyTestChunk,
  ChunkStrategyTestChunkSchema,
} from './chunk-strategy/chunk-strategy-test-chunk.schema';
import { IngestionController } from './controllers/ingestion.controller';
import { IngestionEmbeddingsFactory } from './embeddings/embeddings.factory';
import { DocumentLoaderFactory } from './loaders/document-loader.factory';
import { LangchainDocumentMapper } from './mappers/langchain-document.mapper';
import { Chunk, ChunkSchema } from './schemas/chunk.schema';
import { IngestionService } from './services/ingestion.service';
import { TextSplitterFactory } from './splitters/text-splitter.factory';
import {
  DebugExperimentChunk,
  DebugExperimentChunkSchema,
} from '../schemas/debug-experiment-chunk.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Document.name, schema: DocumentSchema },
      { name: Chunk.name, schema: ChunkSchema },
      {
        name: DebugExperimentChunk.name,
        schema: DebugExperimentChunkSchema,
      },
      {
        name: ChunkStrategyTestChunk.name,
        schema: ChunkStrategyTestChunkSchema,
      },
    ]),
  ],
  controllers: [IngestionController],
  providers: [
    IngestionService,
    DocumentLoaderFactory,
    TextSplitterFactory,
    IngestionEmbeddingsFactory,
    LangchainDocumentMapper,
    ChunkMetadataBuilder,
    ChunkStrategyRunner,
    ChunkStrategyReporter,
  ],
  exports: [
    IngestionService,
    IngestionEmbeddingsFactory,
    DocumentLoaderFactory,
    TextSplitterFactory,
    LangchainDocumentMapper,
    ChunkMetadataBuilder,
    ChunkStrategyRunner,
    ChunkStrategyReporter,
  ],
})
export class IngestionModule {}
