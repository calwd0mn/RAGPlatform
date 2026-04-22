import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { BaseMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableLambda, RunnableSequence } from '@langchain/core/runnables';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { ConversationsService } from '../conversations/services/conversations.service';
import { IngestionEmbeddingsFactory } from '../ingestion/embeddings/embeddings.factory';
import { MessageRoleEnum } from '../messages/interfaces/message-role.type';
import { MessageTrace } from '../messages/interfaces/message-trace.interface';
import { Message, MessageDocument } from '../messages/schemas/message.schema';
import {
  RagContextBuilder,
  RagContextBuildResult,
} from './builders/rag-context.builder';
import { AskRagDto } from './dto/ask-rag.dto';
import { RagChatModelFactory } from './factories/rag-chat-model.factory';
import { RagAnswer } from './interfaces/rag-answer.interface';
import { RagCitation } from './interfaces/rag-citation.interface';
import { RetrievedChunk } from './interfaces/retrieved-chunk.interface';
import { PromptRenderer } from './prompt/prompt-renderer';
import { PromptRegistry, RagPromptDefinition } from './prompt/prompt-registry';
import { ChunkToCitationMapper } from './mappers/chunk-to-citation.mapper';
import { MessageHistoryMapper } from './mappers/message-history.mapper';
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

interface AskExecutionOptions {
  onToken?: (token: string) => Promise<void> | void;
  signal?: AbortSignal;
}

interface AnswerChainInput {
  question: string;
  retrievedChunks: RetrievedChunk[];
  historyItems: HistoryMessageItem[];
}

interface AnswerChainPromptInput {
  context: string;
  history: BaseMessage[];
  question: string;
}

interface GeneratedAnswerResult {
  answer: string;
  contextStats: RagContextBuildResult;
}

@Injectable()
export class RagService {
  private transactionsSupported: boolean | null = null;

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
    private readonly promptRegistry: PromptRegistry,
    private readonly promptRenderer: PromptRenderer,
  ) {}

  async ask(userId: string, dto: AskRagDto): Promise<RagAnswer> {
    return this.executeAsk(userId, dto, {});
  }

  async askStream(
    userId: string,
    dto: AskRagDto,
    options: AskExecutionOptions,
  ): Promise<RagAnswer> {
    return this.executeAsk(userId, dto, options);
  }

  private async executeAsk(
    userId: string,
    dto: AskRagDto,
    options: AskExecutionOptions,
  ): Promise<RagAnswer> {
    const query = dto.query.trim();
    if (query.length === 0) {
      throw new BadRequestException('query must not be empty');
    }

    const topK = dto.topK ?? getRagRetrievalConfig().topKDefault;
    const promptDefinition = this.promptRegistry.getCurrent();
    const startedAt = Date.now();
    let retrievedChunks: RetrievedChunk[] = [];
    let retrievalProvider = '';
    let knowledgeBaseId = '';

    try {
      const conversation = await this.conversationsService.findOneByUser(
        userId,
        dto.conversationId,
      );
      knowledgeBaseId = conversation.knowledgeBaseId;

      const historyItems = await this.findRecentHistory(
        userId,
        dto.conversationId,
        HISTORY_LIMIT,
      );

      const userMessage = await this.createMessageAndTouch({
        userId,
        conversationId: dto.conversationId,
        role: MessageRoleEnum.User,
        content: query,
        citations: [],
        trace: undefined,
      });

      let queryEmbedding: number[];
      try {
        queryEmbedding = await this.embeddingsFactory
          .createEmbeddings()
          .embedQuery(query);
      } catch {
        throw new InternalServerErrorException(
          'Failed to generate query embedding',
        );
      }

      const retrievalOutput =
        await this.ragRetrievalService.retrieveTopKByUserWithProvider(
          userId,
          knowledgeBaseId,
          queryEmbedding,
          topK,
        );
      retrievedChunks = retrievalOutput.chunks;
      retrievalProvider = retrievalOutput.provider;
      const citations = retrievedChunks.map(
        (chunk): RagCitation => this.chunkToCitationMapper.map(chunk),
      );

      const preparedAnswer = this.prepareFallbackAnswer(retrievedChunks);

      const answerResult = await this.generateAnswer({
        question: query,
        preparedAnswer,
        retrievedChunks,
        historyItems,
        promptDefinition,
        options,
      });

      const trace: MessageTrace = {
        knowledgeBaseId,
        query,
        topK,
        retrievedCount: retrievedChunks.length,
        contextChunkCount: answerResult.contextStats.contextChunkCount,
        contextCharCount: answerResult.contextStats.contextCharCount,
        contextTrimmed: answerResult.contextStats.contextTrimmed,
        model: this.ragChatModelFactory.getModelLabel(),
        retrievalProvider,
        promptVersion: promptDefinition.versionedId,
        latencyMs: Date.now() - startedAt,
      };

      const assistantMessage = await this.createMessageAndTouch({
        userId,
        conversationId: dto.conversationId,
        role: MessageRoleEnum.Assistant,
        content: answerResult.answer,
        citations,
        trace,
      });

      return {
        answer: answerResult.answer,
        citations,
        trace: {
          knowledgeBaseId,
          query,
          topK,
          retrievedCount: retrievedChunks.length,
          contextChunkCount: trace.contextChunkCount,
          contextCharCount: trace.contextCharCount,
          contextTrimmed: trace.contextTrimmed,
          model: this.ragChatModelFactory.getModelLabel(),
          retrievalProvider,
          promptVersion: promptDefinition.versionedId,
          latencyMs: trace.latencyMs ?? 0,
        },
        conversationId: dto.conversationId,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to process ask request');
    }
  }

  private async generateAnswer(input: {
    question: string;
    preparedAnswer: string;
    retrievedChunks: RetrievedChunk[];
    historyItems: HistoryMessageItem[];
    promptDefinition: RagPromptDefinition;
    options: AskExecutionOptions;
  }): Promise<GeneratedAnswerResult> {
    try {
      const chainInput = {
        question: input.question,
        retrievedChunks: input.retrievedChunks,
        historyItems: input.historyItems,
      };
      let contextStats: RagContextBuildResult | null = null;
      const chain = await this.buildAnswerChain(
        input.preparedAnswer,
        input.promptDefinition,
        (result): void => {
          contextStats = result;
        },
      );
      const chainConfig = input.options.signal
        ? {
            signal: input.options.signal,
          }
        : undefined;

      if (!input.options.onToken) {
        return {
          answer: (await chain.invoke(chainInput, chainConfig)).trim(),
          contextStats: this.ensureContextStats(contextStats),
        };
      }

      let answerBuffer = '';
      const outputStream = await chain.stream(chainInput, chainConfig);
      for await (const chunk of outputStream) {
        if (typeof chunk !== 'string' || chunk.length === 0) {
          continue;
        }
        if (input.options.signal?.aborted) {
          throw new InternalServerErrorException('Generation aborted');
        }
        answerBuffer += chunk;
        await input.options.onToken(chunk);
      }

      const trimmedAnswer = answerBuffer.trim();
      if (trimmedAnswer.length > 0) {
        return {
          answer: trimmedAnswer,
          contextStats: this.ensureContextStats(contextStats),
        };
      }

      return {
        answer: (await chain.invoke(chainInput, chainConfig)).trim(),
        contextStats: this.ensureContextStats(contextStats),
      };
    } catch {
      throw new InternalServerErrorException('Failed to generate answer');
    }
  }

  private async buildAnswerChain(
    preparedAnswer: string,
    promptDefinition: RagPromptDefinition,
    onContextBuilt: (result: RagContextBuildResult) => void,
  ): Promise<RunnableSequence<AnswerChainInput, string>> {
    const model = await this.ragChatModelFactory.create(preparedAnswer);
    const prompt = this.promptRenderer.createTemplate(promptDefinition);
    const formatPromptInput = RunnableLambda.from<
      AnswerChainInput,
      AnswerChainPromptInput
    >((chainInput: AnswerChainInput): AnswerChainPromptInput => {
      const contextResult = this.ragContextBuilder.build(
        chainInput.retrievedChunks,
      );
      onContextBuilt(contextResult);
      return {
        context: contextResult.context,
        history: this.messageHistoryMapper.toLangchainMessages(
          chainInput.historyItems,
        ),
        question: chainInput.question,
      };
    });

    return RunnableSequence.from([
      formatPromptInput,
      prompt,
      model,
      new StringOutputParser(),
    ]);
  }

  private ensureContextStats(
    contextStats: RagContextBuildResult | null,
  ): RagContextBuildResult {
    if (contextStats) {
      return contextStats;
    }

    return this.ragContextBuilder.build([]);
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

    return messages.reverse().map(
      (message): HistoryMessageItem => ({
        role: message.role,
        content: message.content,
      }),
    );
  }

  private async createMessage(
    input: {
      userId: string;
      conversationId: string;
      role: MessageRoleEnum;
      content: string;
      citations: RagCitation[];
      trace?: MessageTrace;
    },
    session?: ClientSession,
  ): Promise<MessageDocument> {
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

  private async canUseTransaction(): Promise<boolean> {
    if (this.transactionsSupported !== null) {
      return this.transactionsSupported;
    }

    if (!this.connection.db) {
      this.transactionsSupported = false;
      return this.transactionsSupported;
    }

    try {
      const helloResult = (await this.connection.db
        .admin()
        .command({ hello: 1 })) as MongoHelloResult;
      this.transactionsSupported = Boolean(helloResult.setName);
    } catch {
      this.transactionsSupported = false;
    }

    return this.transactionsSupported;
  }

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }

    return new Types.ObjectId(value);
  }
}
