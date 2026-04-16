import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConversationsModule } from '../conversations/conversations.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { Chunk, ChunkSchema } from '../ingestion/schemas/chunk.schema';
import { Message, MessageSchema } from '../messages/schemas/message.schema';
import { RagContextBuilder } from './builders/rag-context.builder';
import { RagController } from './rag.controller';
import { RagChatModelFactory } from './factories/rag-chat-model.factory';
import { ChunkToCitationMapper } from './mappers/chunk-to-citation.mapper';
import { MessageHistoryMapper } from './mappers/message-history.mapper';
import { AtlasVectorRetrievalProvider } from './retrievers/providers/atlas-vector-retrieval.provider';
import { LocalCosineRetrievalProvider } from './retrievers/providers/local-cosine-retrieval.provider';
import { RagRetrievalService } from './retrievers/rag-retrieval.service';
import { RagService } from './rag.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Chunk.name, schema: ChunkSchema },
    ]),
    ConversationsModule,
    IngestionModule,
  ],
  controllers: [RagController],
  providers: [
    RagService,
    RagRetrievalService,
    AtlasVectorRetrievalProvider,
    LocalCosineRetrievalProvider,
    RagContextBuilder,
    MessageHistoryMapper,
    ChunkToCitationMapper,
    RagChatModelFactory,
  ],
})
export class RagModule {}
