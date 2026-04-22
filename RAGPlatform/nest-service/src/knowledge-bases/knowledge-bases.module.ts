import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Conversation,
  ConversationSchema,
} from '../conversations/schemas/conversation.schema';
import { Document, DocumentSchema } from '../documents/schemas/document.schema';
import { Chunk, ChunkSchema } from '../ingestion/schemas/chunk.schema';
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
    ]),
  ],
  controllers: [KnowledgeBasesController],
  providers: [KnowledgeBasesService],
  exports: [KnowledgeBasesService],
})
export class KnowledgeBasesModule {}
