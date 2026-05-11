import {
  BadRequestException,
  ConflictException,
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
import { MessageGenerationStatus } from '../messages/interfaces/message-generation-status.type';
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
import { RagTrace } from './interfaces/rag-trace.interface';
import { RetrievedChunk } from './interfaces/retrieved-chunk.interface';
import { PromptRenderer } from './prompt/prompt-renderer';
import { PromptRegistry, RagPromptDefinition } from './prompt/prompt-registry';
import { ChunkToCitationMapper } from './mappers/chunk-to-citation.mapper';
import { MessageHistoryMapper } from './mappers/message-history.mapper';
import { getRagRetrievalConfig } from './retrievers/config/rag-retrieval.config';
import { RagRetrievalService } from './retrievers/rag-retrieval.service';

const HISTORY_LIMIT = 8;
const STREAMING_MESSAGE_PLACEHOLDER = '正在生成...';
const INTERRUPTED_MESSAGE_FALLBACK = '已停止生成。';
const FAILED_MESSAGE_FALLBACK = '生成失败，请稍后重试。';
const STREAM_FLUSH_INTERVAL_MS = 1000;
const STREAM_FLUSH_CHAR_THRESHOLD = 200;
const STALE_STREAMING_REQUEST_MS = 2 * 60 * 1000;

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
  status: Extract<MessageGenerationStatus, 'completed' | 'interrupted'>;
}

export interface WorkflowRagRetrievalResult {
  query: string;
  topK: number;
  chunks: RetrievedChunk[];
  citations: RagCitation[];
  retrievalProvider: string;
}

export interface WorkflowRagAnswerInput {
  knowledgeBaseId: string;
  query: string;
  topK: number;
  chunks: RetrievedChunk[];
  retrievalProvider: string;
  onToken?: (token: string) => Promise<void> | void;
  signal?: AbortSignal;
}

export interface WorkflowRagAnswerResult {
  answer: string;
  citations: RagCitation[];
  trace: {
    knowledgeBaseId: string;
    query: string;
    topK: number;
    retrievedCount: number;
    contextChunkCount: number;
    contextCharCount: number;
    contextTrimmed: boolean;
    model: string;
    retrievalProvider: string;
    promptVersion: string;
    latencyMs: number;
  };
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

  async retrieveForWorkflow(input: {
    userId: string;
    knowledgeBaseId: string;
    query: string;
    topK: number;
  }): Promise<WorkflowRagRetrievalResult> {
    const retrievalOutput =
      await this.ragRetrievalService.retrieveTopKByQueryWithProvider(input);

    return {
      query: input.query,
      topK: input.topK,
      chunks: retrievalOutput.chunks,
      citations: retrievalOutput.chunks.map(
        (chunk): RagCitation => this.chunkToCitationMapper.map(chunk),
      ),
      retrievalProvider: retrievalOutput.provider,
    };
  }

  async answerWorkflow(
    input: WorkflowRagAnswerInput,
  ): Promise<WorkflowRagAnswerResult> {
    const promptDefinition = this.promptRegistry.getCurrent();
    const startedAt = Date.now();
    const answerResult = await this.generateAnswer({
      question: input.query,
      preparedAnswer: this.prepareFallbackAnswer(input.chunks),
      retrievedChunks: input.chunks,
      historyItems: [],
      promptDefinition,
      options: {
        onToken: input.onToken,
        signal: input.signal,
      },
    });

    return {
      answer: answerResult.answer,
      citations: input.chunks.map(
        (chunk): RagCitation => this.chunkToCitationMapper.map(chunk),
      ),
      trace: {
        knowledgeBaseId: input.knowledgeBaseId,
        query: input.query,
        topK: input.topK,
        retrievedCount: input.chunks.length,
        contextChunkCount: answerResult.contextStats.contextChunkCount,
        contextCharCount: answerResult.contextStats.contextCharCount,
        contextTrimmed: answerResult.contextStats.contextTrimmed,
        model: this.ragChatModelFactory.getModelLabel(),
        retrievalProvider: input.retrievalProvider,
        promptVersion: promptDefinition.versionedId,
        latencyMs: Date.now() - startedAt,
      },
    };
  }

  private async executeAsk(
    userId: string,
    dto: AskRagDto,
    options: AskExecutionOptions,
  ): Promise<RagAnswer> {
    // 验证query
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
    let assistantMessage: MessageDocument | null = null;
    let lastFlushedAnswer = '';
    let lastFlushAt = Date.now();

    try {
      // 查会话，拿知识库id
      const conversation = await this.conversationsService.findOneByUser(
        userId,
        dto.conversationId,
      );
      knowledgeBaseId = conversation.knowledgeBaseId;

      const idempotentAnswer = await this.findCompletedIdempotentAnswer({
        userId,
        conversationId: dto.conversationId,
        query,
        requestId: dto.requestId,
      });
      if (idempotentAnswer) {
        return idempotentAnswer;
      }

      // 拿历史消息(不区分角色)
      const historyItems = await this.findRecentHistory(
        userId,
        dto.conversationId,
        HISTORY_LIMIT,
      );
      // message入库
      const userMessage = await this.createUserMessageForRequest({
        userId,
        conversationId: dto.conversationId,
        content: query,
        requestId: dto.requestId,
      });
      // 进入检索
      const retrievalOutput =
        await this.ragRetrievalService.retrieveTopKByQueryWithProvider({
          userId,
          knowledgeBaseId,
          query,
          topK,
        });
      retrievedChunks = retrievalOutput.chunks;
      retrievalProvider = retrievalOutput.provider;
      const citations = retrievedChunks.map(
        (chunk): RagCitation => this.chunkToCitationMapper.map(chunk),
      );

      const preparedAnswer = this.prepareFallbackAnswer(retrievedChunks);
      const createdAssistantMessage = await this.createMessageAndTouch({
        userId,
        conversationId: dto.conversationId,
        role: MessageRoleEnum.Assistant,
        content: STREAMING_MESSAGE_PLACEHOLDER,
        citations,
        trace: undefined,
        requestId: dto.requestId,
        status: 'streaming',
      });
      assistantMessage = createdAssistantMessage;

      const flushAnswerSnapshot = async (
        answer: string,
        force: boolean,
      ): Promise<void> => {
        const normalizedAnswer = answer.trim();
        if (normalizedAnswer.length === 0) {
          return;
        }

        const now = Date.now();
        const newCharCount = normalizedAnswer.length - lastFlushedAnswer.length;
        if (
          !force &&
          newCharCount < STREAM_FLUSH_CHAR_THRESHOLD &&
          now - lastFlushAt < STREAM_FLUSH_INTERVAL_MS
        ) {
          return;
        }

        await this.updateAssistantMessage({
          userId,
          conversationId: dto.conversationId,
          messageId: createdAssistantMessage.id,
          content: normalizedAnswer,
          citations,
          trace: undefined,
          status: 'streaming',
        });
        lastFlushedAnswer = normalizedAnswer;
        lastFlushAt = now;
      };

      const answerResult = await this.generateAnswer({
        question: query,
        preparedAnswer,
        retrievedChunks,
        historyItems,
        promptDefinition,
        options,
        onAnswerSnapshot: (answer): Promise<void> =>
          flushAnswerSnapshot(answer, false),
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

      const finalAnswer = this.normalizeGeneratedAnswer(
        answerResult.answer,
        answerResult.status,
      );
      await flushAnswerSnapshot(finalAnswer, true);
      assistantMessage = await this.updateAssistantMessage({
        userId,
        conversationId: dto.conversationId,
        messageId: createdAssistantMessage.id,
        content: finalAnswer,
        citations,
        trace,
        status: answerResult.status,
      });

      return {
        answer: finalAnswer,
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
        requestId: dto.requestId,
        status: answerResult.status,
      };
    } catch (error) {
      if (assistantMessage) {
        try {
          await this.markAssistantMessageFailed({
            userId,
            conversationId: dto.conversationId,
            messageId: assistantMessage.id,
            content: lastFlushedAnswer,
          });
        } catch {
          // Keep the original generation error as the response cause.
        }
      }

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
    onAnswerSnapshot?: (answer: string) => Promise<void> | void;
  }): Promise<GeneratedAnswerResult> {
    let answerBuffer = '';
    let contextStats: RagContextBuildResult | null = null;

    try {
      const chainInput = {
        question: input.question,
        retrievedChunks: input.retrievedChunks,
        historyItems: input.historyItems,
      };
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
          status: 'completed',
        };
      }

      const outputStream = await chain.stream(chainInput, chainConfig);
      for await (const chunk of outputStream) {
        if (typeof chunk !== 'string' || chunk.length === 0) {
          continue;
        }
        if (input.options.signal?.aborted) {
          return {
            answer: answerBuffer.trim(),
            contextStats: this.ensureContextStats(contextStats),
            status: 'interrupted',
          };
        }
        answerBuffer += chunk;
        await input.onAnswerSnapshot?.(answerBuffer);
        await input.options.onToken(chunk);
      }

      const trimmedAnswer = answerBuffer.trim();
      if (trimmedAnswer.length > 0) {
        return {
          answer: trimmedAnswer,
          contextStats: this.ensureContextStats(contextStats),
          status: 'completed',
        };
      }

      return {
        answer: (await chain.invoke(chainInput, chainConfig)).trim(),
        contextStats: this.ensureContextStats(contextStats),
        status: 'completed',
      };
    } catch (error) {
      if (input.options.signal?.aborted || this.isAbortLikeError(error)) {
        return {
          answer: answerBuffer.trim(),
          contextStats: this.ensureContextStats(contextStats),
          status: 'interrupted',
        };
      }

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
    // 逻辑等同于
    // return formatPromptInput.pipe(prompt).pipe(model).pipe(parser);
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

  private async findCompletedIdempotentAnswer(input: {
    userId: string;
    conversationId: string;
    query: string;
    requestId?: string;
  }): Promise<RagAnswer | null> {
    if (!input.requestId) {
      return null;
    }

    const userMessage = await this.findMessageByRequestId({
      userId: input.userId,
      requestId: input.requestId,
      role: MessageRoleEnum.User,
    });
    if (userMessage) {
      this.ensureIdempotentUserMessageMatches({
        message: userMessage,
        conversationId: input.conversationId,
        query: input.query,
      });
    }

    const assistantMessage = await this.findMessageByRequestId({
      userId: input.userId,
      requestId: input.requestId,
      role: MessageRoleEnum.Assistant,
    });
    if (!assistantMessage) {
      return null;
    }

    if (assistantMessage.conversationId.toString() !== input.conversationId) {
      throw new BadRequestException(
        'requestId has been used by another conversation',
      );
    }

    if (!userMessage) {
      throw new ConflictException('requestId state is incomplete');
    }

    if (assistantMessage.status === 'streaming') {
      const isStale =
        Date.now() - assistantMessage.updatedAt.getTime() >=
        STALE_STREAMING_REQUEST_MS;
      if (!isStale) {
        throw new ConflictException('当前请求正在生成中，请稍后重试');
      }

      const interruptedMessage = await this.updateAssistantMessage({
        userId: input.userId,
        conversationId: input.conversationId,
        messageId: assistantMessage.id,
        content: this.normalizeGeneratedAnswer(
          assistantMessage.content === STREAMING_MESSAGE_PLACEHOLDER
            ? ''
            : assistantMessage.content,
          'interrupted',
        ),
        citations: assistantMessage.citations,
        trace: assistantMessage.trace,
        status: 'interrupted',
      });

      return this.toRagAnswerFromMessages({
        userMessage,
        assistantMessage: interruptedMessage,
        requestId: input.requestId,
      });
    }

    return this.toRagAnswerFromMessages({
      userMessage,
      assistantMessage,
      requestId: input.requestId,
    });
  }

  private async createUserMessageForRequest(input: {
    userId: string;
    conversationId: string;
    content: string;
    requestId?: string;
  }): Promise<MessageDocument> {
    if (input.requestId) {
      const existingMessage = await this.findMessageByRequestId({
        userId: input.userId,
        requestId: input.requestId,
        role: MessageRoleEnum.User,
      });
      if (existingMessage) {
        this.ensureIdempotentUserMessageMatches({
          message: existingMessage,
          conversationId: input.conversationId,
          query: input.content,
        });
        return existingMessage;
      }
    }

    return this.createMessageAndTouch({
      userId: input.userId,
      conversationId: input.conversationId,
      role: MessageRoleEnum.User,
      content: input.content,
      citations: [],
      trace: undefined,
      requestId: input.requestId,
      status: 'completed',
    });
  }

  private async findMessageByRequestId(input: {
    userId: string;
    requestId: string;
    role: MessageRoleEnum;
  }): Promise<MessageDocument | null> {
    return this.messageModel
      .findOne({
        userId: this.toObjectId(input.userId),
        requestId: input.requestId,
        role: input.role,
      })
      .exec();
  }

  //  确保幂等请求的用户消息一致
  private ensureIdempotentUserMessageMatches(input: {
    message: MessageDocument;
    conversationId: string;
    query: string;
  }): void {
    if (
      input.message.conversationId.toString() !== input.conversationId ||
      input.message.content !== input.query
    ) {
      throw new BadRequestException(
        'requestId has been used by another ask request',
      );
    }
  }

  private toRagAnswerFromMessages(input: {
    userMessage: MessageDocument;
    assistantMessage: MessageDocument;
    requestId: string;
  }): RagAnswer {
    return {
      answer: input.assistantMessage.content,
      citations: input.assistantMessage.citations,
      trace: this.toRagTrace(input.assistantMessage.trace),
      conversationId: input.assistantMessage.conversationId.toString(),
      userMessageId: input.userMessage.id,
      assistantMessageId: input.assistantMessage.id,
      requestId: input.requestId,
      status: input.assistantMessage.status ?? 'completed',
    };
  }

  private toRagTrace(trace: MessageTrace | undefined): RagTrace {
    return {
      knowledgeBaseId: trace?.knowledgeBaseId ?? '',
      query: trace?.query ?? '',
      rewrittenQuery: trace?.rewrittenQuery,
      topK: trace?.topK ?? 0,
      retrievedCount: trace?.retrievedCount ?? 0,
      contextChunkCount: trace?.contextChunkCount,
      contextCharCount: trace?.contextCharCount,
      contextTrimmed: trace?.contextTrimmed,
      model: trace?.model,
      retrievalProvider: trace?.retrievalProvider,
      promptVersion: trace?.promptVersion ?? '',
      latencyMs: trace?.latencyMs ?? 0,
    };
  }

  private normalizeGeneratedAnswer(
    answer: string,
    status: MessageGenerationStatus,
  ): string {
    const normalizedAnswer = answer.trim();
    if (normalizedAnswer.length > 0) {
      return normalizedAnswer;
    }

    if (status === 'interrupted') {
      return INTERRUPTED_MESSAGE_FALLBACK;
    }

    return FAILED_MESSAGE_FALLBACK;
  }

  private isAbortLikeError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return (
      error.name === 'AbortError' ||
      error.message.toLowerCase().includes('abort')
    );
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
      requestId?: string;
      status: MessageGenerationStatus;
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
      requestId: input.requestId,
      status: input.status,
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
    requestId?: string;
    status: MessageGenerationStatus;
  }): Promise<MessageDocument> {
    if (!(await this.canUseTransaction())) {
      const savedMessage = await this.createMessage(input);
      // 更新conversation的lastupdate
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

  private async updateAssistantMessage(input: {
    userId: string;
    conversationId: string;
    messageId: string;
    content: string;
    citations: RagCitation[];
    trace?: MessageTrace;
    status: MessageGenerationStatus;
  }): Promise<MessageDocument> {
    const updatedMessage = await this.messageModel
      .findOneAndUpdate(
        {
          _id: this.toObjectId(input.messageId),
          userId: this.toObjectId(input.userId),
          conversationId: this.toObjectId(input.conversationId),
          role: MessageRoleEnum.Assistant,
        },
        {
          $set: {
            content: input.content.trim(),
            citations: input.citations,
            trace: input.trace,
            status: input.status,
          },
        },
        { new: true },
      )
      .exec();

    if (!updatedMessage) {
      throw new InternalServerErrorException('Failed to persist message');
    }

    if (updatedMessage.status !== 'streaming') {
      await this.conversationsService.touchLastMessageAt(
        input.userId,
        input.conversationId,
        updatedMessage.updatedAt,
      );
    }

    return updatedMessage;
  }

  private async markAssistantMessageFailed(input: {
    userId: string;
    conversationId: string;
    messageId: string;
    content: string;
  }): Promise<void> {
    const content =
      input.content.trim().length > 0 ? input.content : FAILED_MESSAGE_FALLBACK;
    await this.updateAssistantMessage({
      userId: input.userId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      content,
      citations: [],
      trace: undefined,
      status: 'failed',
    });
  }
}
