import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Chunk, ChunkSchema } from '../ingestion/schemas/chunk.schema';
import { KnowledgeBasesModule } from '../knowledge-bases/knowledge-bases.module';
import {
  DebugExperimentChunk,
  DebugExperimentChunkSchema,
} from '../schemas/debug-experiment-chunk.schema';
import { DocumentsController } from './controllers/documents.controller';
import { Document, DocumentSchema } from './schemas/document.schema';
import { DocumentsService } from './services/documents.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Document.name, schema: DocumentSchema },
      { name: Chunk.name, schema: ChunkSchema },
      {
        name: DebugExperimentChunk.name,
        schema: DebugExperimentChunkSchema,
      },
    ]),
    KnowledgeBasesModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
