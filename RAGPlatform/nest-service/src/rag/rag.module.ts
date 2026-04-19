import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConversationsModule } from '../conversations/conversations.module';
import { Document, DocumentSchema } from '../documents/schemas/document.schema';
import { IngestionModule } from '../ingestion/ingestion.module';
import { KnowledgeBasesModule } from '../knowledge-bases/knowledge-bases.module';
import { ChunkStrategyService } from '../ingestion/chunk-strategy/chunk-strategy.service';
import { Chunk, ChunkSchema } from '../ingestion/schemas/chunk.schema';
import { Message, MessageSchema } from '../messages/schemas/message.schema';
import {
  DebugExperiment,
  DebugExperimentSchema,
} from '../schemas/debug-experiment.schema';
import {
  DebugExperimentChunk,
  DebugExperimentChunkSchema,
} from '../schemas/debug-experiment-chunk.schema';
import { RagRun, RagRunSchema } from '../schemas/rag-run.schema';
import { RagContextBuilder } from './builders/rag-context.builder';
import { DebugExperimentsService } from './debug/debug-experiments.service';
import { RagDebugController } from './debug/rag-debug.controller';
import { RagDebugService } from './debug/rag-debug.service';
import { RagRunRecorderService } from './debug/rag-run-recorder.service';
import { RagController } from './rag.controller';
import { RagChatModelFactory } from './factories/rag-chat-model.factory';
import { ChunkToCitationMapper } from './mappers/chunk-to-citation.mapper';
import { MessageHistoryMapper } from './mappers/message-history.mapper';
import { PromptRenderer } from './prompt/prompt-renderer';
import { PromptRegistry } from './prompt/prompt-registry';
import { AtlasVectorRetrievalProvider } from './retrievers/providers/atlas-vector-retrieval.provider';
import { DebugExperimentRetrievalProvider } from './retrievers/providers/debug-experiment-retrieval.provider';
import { LocalCosineRetrievalProvider } from './retrievers/providers/local-cosine-retrieval.provider';
import { RagRetrievalService } from './retrievers/rag-retrieval.service';
import { RagService } from './rag.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Document.name, schema: DocumentSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Chunk.name, schema: ChunkSchema },
      { name: RagRun.name, schema: RagRunSchema },
      { name: DebugExperiment.name, schema: DebugExperimentSchema },
      {
        name: DebugExperimentChunk.name,
        schema: DebugExperimentChunkSchema,
      },
    ]),
    ConversationsModule,
    IngestionModule,
    KnowledgeBasesModule,
  ],
  controllers: [RagController, RagDebugController],
  providers: [
    RagService,
    RagDebugService,
    DebugExperimentsService,
    RagRunRecorderService,
    RagRetrievalService,
    AtlasVectorRetrievalProvider,
    LocalCosineRetrievalProvider,
    DebugExperimentRetrievalProvider,
    RagContextBuilder,
    MessageHistoryMapper,
    ChunkToCitationMapper,
    RagChatModelFactory,
    PromptRegistry,
    PromptRenderer,
    ChunkStrategyService,
  ],
})
export class RagModule {}
