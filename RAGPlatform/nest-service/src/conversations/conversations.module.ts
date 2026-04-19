import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KnowledgeBasesModule } from '../knowledge-bases/knowledge-bases.module';
import { Message, MessageSchema } from '../messages/schemas/message.schema';
import { ConversationsController } from './controllers/conversations.controller';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { ConversationsService } from './services/conversations.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    KnowledgeBasesModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
