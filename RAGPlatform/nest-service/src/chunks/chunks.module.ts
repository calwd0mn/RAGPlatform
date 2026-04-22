import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Document, DocumentSchema } from '../documents/schemas/document.schema';
import { Chunk, ChunkSchema } from '../ingestion/schemas/chunk.schema';
import { IngestionModule } from '../ingestion/ingestion.module';
import {
  DebugExperimentChunk,
  DebugExperimentChunkSchema,
} from '../schemas/debug-experiment-chunk.schema';
import { ChunksController } from './controllers/chunks.controller';
import { ChunksService } from './services/chunks.service';

@Module({
  imports: [
    IngestionModule,
    // 注册schema
    MongooseModule.forFeature([
      { name: Chunk.name, schema: ChunkSchema },
      {
        name: DebugExperimentChunk.name,
        schema: DebugExperimentChunkSchema,
      },
      { name: Document.name, schema: DocumentSchema },
    ]),
  ],
  controllers: [ChunksController],
  providers: [ChunksService],
  exports: [ChunksService],
})
export class ChunksModule {}
