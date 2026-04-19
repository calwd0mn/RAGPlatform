import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Conversation, ConversationSchema } from '../conversations/schemas/conversation.schema';
import { Document, DocumentSchema } from '../documents/schemas/document.schema';
import { Chunk, ChunkSchema } from '../ingestion/schemas/chunk.schema';
import {
  DebugExperiment,
  DebugExperimentSchema,
} from '../schemas/debug-experiment.schema';
import {
  DebugExperimentChunk,
  DebugExperimentChunkSchema,
} from '../schemas/debug-experiment-chunk.schema';
import { RagRun, RagRunSchema } from '../schemas/rag-run.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { KnowledgeBasesController } from './knowledge-bases.controller';
import { KnowledgeBasesService } from './knowledge-bases.service';
import {
  KnowledgeBase,
  KnowledgeBaseSchema,
} from './schemas/knowledge-base.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KnowledgeBase.name, schema: KnowledgeBaseSchema },
      { name: User.name, schema: UserSchema },
      { name: Document.name, schema: DocumentSchema },
      { name: Chunk.name, schema: ChunkSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: RagRun.name, schema: RagRunSchema },
      { name: DebugExperiment.name, schema: DebugExperimentSchema },
      {
        name: DebugExperimentChunk.name,
        schema: DebugExperimentChunkSchema,
      },
    ]),
  ],
  controllers: [KnowledgeBasesController],
  providers: [KnowledgeBasesService],
  exports: [KnowledgeBasesService],
})
export class KnowledgeBasesModule {}
