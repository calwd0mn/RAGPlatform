import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Chunk, ChunkSchema } from '../ingestion/schemas/chunk.schema';
import { KnowledgeBasesModule } from '../knowledge-bases/knowledge-bases.module';
import { DocumentsController } from './controllers/documents.controller';
import { Document, DocumentSchema } from './schemas/document.schema';
import { DocumentsService } from './services/documents.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Document.name, schema: DocumentSchema },
      { name: Chunk.name, schema: ChunkSchema },
    ]),
    KnowledgeBasesModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
