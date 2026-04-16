import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { ConversationsService } from '../conversations/services/conversations.service';
import { IngestionEmbeddingsFactory } from '../ingestion/embeddings/embeddings.factory';
import { MessageRoleEnum } from '../messages/interfaces/message-role.type';
import { MessageTrace } from '../messages/interfaces/message-trace.interface';
import { Message, MessageDocument } from '../messages/schemas/message.schema';
import { RagContextBuilder } from './builders/rag-context.builder';
import { AskRagDto } from './dto/ask-rag.dto';
import { RagChatModelFactory } from './factories/rag-chat-model.factory';
import { RagAnswer } from './interfaces/rag-answer.interface';
import { RagCitation } from './interfaces/rag-citation.interface';
import { RetrievedChunk } from './interfaces/retrieved-chunk.interface';
import { ChunkToCitationMapper } from './mappers/chunk-to-citation.mapper';
import { MessageHistoryMapper } from './mappers/message-history.mapper';
import { RAG_SYSTEM_PROMPT } from './prompts/rag-answer.prompt';
import { getRagRetrievalConfig } from './retrievers/config/rag-retrieval.config';
import { RagRetrievalService } from './retrievers/rag-retrieval.service';

const HISTORY_LIMIT = 8;

interface HistoryMessageItem {
  role: MessageRoleEnum;
  content: string;
}

interface MongoHelloResult {
  setName?: string;
}

@Injectable()
export class RagService {
  private testTransactionsSupported: boolean | null = null;

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly conversationsService: ConversationsService,
    private readonly embeddingsFactory: IngestionEmbeddingsFactory,
    private readonly ragRetrievalService: RagRetrievalService,
    private readonly ragContextBuilder: RagContextBuilder,
    private readonly messageHistoryMapper: MessageHistoryMapper,
    private readonly chunkToCitationMapper: ChunkToCitationMapper,
    private readonly ragChatModelFactory: RagChatModelFactory,
  ) {}

  async ask(userId: string, dto: AskRagDto): Promise<RagAnswer> {
    const query = dto.query.trim();
    if (query.length === 0) {
      throw new BadRequestException('query must not be empty');
    }

    const topK = dto.topK ?? getRagRetrievalConfig().topKDefault;
    const startedAt = Date.now();

    await this.conversationsService.ensureOwnedConversation(userId, dto.conversationId);

    const userMessage = await this.createMessageAndTouch({
      userId,
      conversationId: dto.conversationId,
      role: MessageRoleEnum.User,
      content: query,
      citations: [],
      trace: undefined,
    });

    const historyItems = await this.findRecentHistory(userId, dto.conversationId, HISTORY_LIMIT);

    let queryEmbedding: number[];
    try {
      queryEmbedding = await this.embeddingsFactory.createEmbeddings().embedQuery(query);
    } catch {
      throw new InternalServerErrorException('Failed to generate query embedding');
    }

    let retrievedChunks: RetrievedChunk[];
    let retrievalProvider: string;
    try {
      const retrievalOutput =
        await this.ragRetrievalService.retrieveTopKByUserWithProvider(
          userId,
          queryEmbedding,
          topK,
        );
      retrievedChunks = retrievalOutput.chunks;
      retrievalProvider = retrievalOutput.provider;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to retrieve relevant chunks');
    }

    const context = this.ragContextBuilder.build(retrievedChunks);
    const citations = retrievedChunks.map((chunk): RagCitation =>
      this.chunkToCitationMapper.map(chunk),
    );

    const preparedAnswer = this.prepareFallbackAnswer(retrievedChunks);

    let answer: string;
    try {
      const model = await this.ragChatModelFactory.create(preparedAnswer);
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', RAG_SYSTEM_PROMPT],
        ['system', '检索上下文如下：\n{context}'],
        new MessagesPlaceholder('history'),
      ]);
      const chain = RunnableSequence.from([prompt, model, new StringOutputParser()]);
      answer = (await chain.invoke({
        context,
        history: this.messageHistoryMapper.toLangchainMessages(historyItems),
      })).trim();
    } catch {
      throw new InternalServerErrorException('Failed to generate answer');
    }

    const trace: MessageTrace = {
      query,
      topK,
      retrievedCount: retrievedChunks.length,
      model: this.ragChatModelFactory.getModelLabel(),
      retrievalProvider,
      latencyMs: Date.now() - startedAt,
    };

    const assistantMessage = await this.createMessageAndTouch({
      userId,
      conversationId: dto.conversationId,
      role: MessageRoleEnum.Assistant,
      content: answer,
      citations,
      trace,
    });

    return {
      answer,
      citations,
      trace: {
        query,
        topK,
        retrievedCount: retrievedChunks.length,
        model: this.ragChatModelFactory.getModelLabel(),
        retrievalProvider,
        latencyMs: trace.latencyMs ?? 0,
      },
      conversationId: dto.conversationId,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
    };
  }

  private prepareFallbackAnswer(chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) {
      return '根据当前已检索到的信息无法确定。';
    }

    const supportingLines = chunks
      .slice(0, 3)
      .map((chunk): string => `- ${chunk.content.slice(0, 180)}`)
      .join('\n');

    return `基于已检索到的信息，可参考以下证据：\n${supportingLines}`;
  }

  private async findRecentHistory(
    userId: string,
    conversationId: string,
    limit: number,
  ): Promise<HistoryMessageItem[]> {
    const messages = await this.messageModel
      .find({
        userId: this.toObjectId(userId),
        conversationId: this.toObjectId(conversationId),
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    return messages
      .reverse()
      .map(
        (message): HistoryMessageItem => ({
          role: message.role,
          content: message.content,
        }),
      );
  }

  private async createMessage(input: {
    userId: string;
    conversationId: string;
    role: MessageRoleEnum;
    content: string;
    citations: RagCitation[];
    trace?: MessageTrace;
  }, session?: ClientSession): Promise<MessageDocument> {
    const createdMessage = new this.messageModel({
      userId: this.toObjectId(input.userId),
      conversationId: this.toObjectId(input.conversationId),
      role: input.role,
      content: input.content.trim(),
      citations: input.citations,
      trace: input.trace,
    });

    try {
      return await createdMessage.save({ session });
    } catch {
      throw new InternalServerErrorException('Failed to persist message');
    }
  }

  private async createMessageAndTouch(input: {
    userId: string;
    conversationId: string;
    role: MessageRoleEnum;
    content: string;
    citations: RagCitation[];
    trace?: MessageTrace;
  }): Promise<MessageDocument> {
    if (!(await this.canUseTransaction())) {
      const savedMessage = await this.createMessage(input);
      await this.conversationsService.touchLastMessageAt(
        input.userId,
        input.conversationId,
        savedMessage.createdAt,
      );
      return savedMessage;
    }

    const session = await this.connection.startSession();
    let savedMessage: MessageDocument | null = null;

    try {
      await session.withTransaction(async (): Promise<void> => {
        savedMessage = await this.createMessage(input, session);
        await this.conversationsService.touchLastMessageAt(
          input.userId,
          input.conversationId,
          savedMessage.createdAt,
          session,
        );
      });
    } finally {
      await session.endSession();
    }

    if (!savedMessage) {
      throw new InternalServerErrorException('Failed to persist message');
    }

    return savedMessage;
  }

  private isTestEnvironment(): boolean {
    return (process.env.NODE_ENV ?? '').trim().toLowerCase() === 'test';
  }

  private async canUseTransaction(): Promise<boolean> {
    if (!this.isTestEnvironment()) {
      return true;
    }

    if (this.testTransactionsSupported !== null) {
      return this.testTransactionsSupported;
    }

    if (!this.connection.db) {
      this.testTransactionsSupported = false;
      return this.testTransactionsSupported;
    }

    try {
      const helloResult = await this.connection.db.admin().command({ hello: 1 }) as MongoHelloResult;
      this.testTransactionsSupported = Boolean(helloResult.setName);
    } catch {
      this.testTransactionsSupported = false;
    }

    return this.testTransactionsSupported;
  }

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }

    return new Types.ObjectId(value);
  }
}
