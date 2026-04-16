import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Document, DocumentSchema } from '../documents/schemas/document.schema';
import { ChunkMetadataBuilder } from './builders/chunk-metadata.builder';
import { IngestionController } from './controllers/ingestion.controller';
import { IngestionEmbeddingsFactory } from './embeddings/embeddings.factory';
import { DocumentLoaderFactory } from './loaders/document-loader.factory';
import { LangchainDocumentMapper } from './mappers/langchain-document.mapper';
import { Chunk, ChunkSchema } from './schemas/chunk.schema';
import { IngestionService } from './services/ingestion.service';
import { TextSplitterFactory } from './splitters/text-splitter.factory';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Document.name, schema: DocumentSchema },
      { name: Chunk.name, schema: ChunkSchema },
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
  ],
  exports: [IngestionService, IngestionEmbeddingsFactory],
})
export class IngestionModule {}

