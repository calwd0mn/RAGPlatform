import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConversationsService } from '../../conversations/services/conversations.service';
import { ChunkStrategyService } from '../../ingestion/chunk-strategy/chunk-strategy.service';
import { RunChunkStrategyTestDto } from '../../ingestion/chunk-strategy/dto/run-chunk-strategy-test.dto';
import { IngestionEmbeddingsFactory } from '../../ingestion/embeddings/embeddings.factory';
import { MessageRoleEnum } from '../../messages/interfaces/message-role.type';
import { Message, MessageDocument } from '../../messages/schemas/message.schema';
import {
  ChunkStrategyDraft,
  PromptDraft,
} from '../../schemas/debug-experiment.schema';
import { RagRun, RagRunDocument, RagRunStatus, RagRunType } from '../../schemas/rag-run.schema';
import { RagContextBuilder } from '../builders/rag-context.builder';
import { MessageHistoryMapper } from '../mappers/message-history.mapper';
import { PromptRenderer } from '../prompt/prompt-renderer';
import { PromptRegistry } from '../prompt/prompt-registry';
import { getRagRetrievalConfig } from '../retrievers/config/rag-retrieval.config';
import { RagRetrievalService } from '../retrievers/rag-retrieval.service';
import { GetRagRunsQueryDto } from './dto/get-rag-runs-query.dto';
import { RenderRagPromptDto } from './dto/render-rag-prompt.dto';
import { RetrieveRagDebugDto } from './dto/retrieve-rag-debug.dto';
import { RagRunRecorderService } from './rag-run-recorder.service';
import { mapRetrievedChunksToRunHits } from './utils/map-retrieval-hits.util';

const HISTORY_LIMIT = 8;

interface HistoryMessageItem {
  role: MessageRoleEnum;
  content: string;
}

@Injectable()
export class RagDebugService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(RagRun.name)
    private readonly ragRunModel: Model<RagRunDocument>,
    private readonly conversationsService: ConversationsService,
    private readonly embeddingsFactory: IngestionEmbeddingsFactory,
    private readonly ragRetrievalService: RagRetrievalService,
    private readonly ragContextBuilder: RagContextBuilder,
    private readonly messageHistoryMapper: MessageHistoryMapper,
    private readonly promptRegistry: PromptRegistry,
    private readonly promptRenderer: PromptRenderer,
    private readonly ragRunRecorder: RagRunRecorderService,
    private readonly chunkStrategyService: ChunkStrategyService,
  ) {}

  runChunkStrategyTest(
    userId: string,
    dto: RunChunkStrategyTestDto,
  ): ReturnType<ChunkStrategyService['runTest']> {
    this.assertDebugEnabled();
    return this.chunkStrategyService.runTest(userId, dto);
  }

  getCurrentPrompt(): { id: string; version: string; versionedId: string; systemPrompt: string; contextTemplate: string } {
    this.assertDebugEnabled();
    const current = this.promptRegistry.getCurrent();
    return {
      id: current.id,
      version: current.version,
      versionedId: current.versionedId,
      systemPrompt: current.systemPrompt,
      contextTemplate: current.contextTemplate,
    };
  }

  async renderPrompt(userId: string, dto: RenderRagPromptDto): Promise<{
    query: string;
    topK: number;
    promptVersion: string;
    retrievalProvider: string;
    retrievedCount: number;
    retrievalHits: ReturnType<typeof mapRetrievedChunksToRunHits>;
    promptInput: {
      context: string;
      historyCount: number;
    };
    promptOutput: {
      messages: { role: string; content: string }[];
      promptText: string;
    };
    latencyMs: number;
  }> {
    this.assertDebugEnabled();
    const query = dto.query.trim();
    if (query.length === 0) {
      throw new BadRequestException('query must not be empty');
    }

    const topK = dto.topK ?? getRagRetrievalConfig().topKDefault;
    const promptDefinition = this.promptRegistry.getCurrent();
    const startedAt = Date.now();
    const knowledgeBaseId = dto.knowledgeBaseId;
    let retrievalProvider = '';
    let retrievalHits = mapRetrievedChunksToRunHits([]);

    try {
      const embedding = await this.embeddingsFactory.createEmbeddings().embedQuery(query);
      const retrievalOutput =
        await this.ragRetrievalService.retrieveTopKByUserWithProvider(
          userId,
          knowledgeBaseId,
          embedding,
          topK,
        );
      retrievalProvider = retrievalOutput.provider;
      retrievalHits = mapRetrievedChunksToRunHits(retrievalOutput.chunks);

      const context = this.ragContextBuilder.build(retrievalOutput.chunks);
      const historyFromStore = dto.conversationId
        ? await this.findRecentHistory(userId, dto.conversationId, HISTORY_LIMIT)
        : [];
      const historyItems = this.withCurrentQuery(historyFromStore, query);

      const rendered = await this.promptRenderer.render({
        definition: promptDefinition,
        context,
        history: this.messageHistoryMapper.toLangchainMessages(historyItems),
      });

      await this.recordDebugRun({
        userId,
        knowledgeBaseId,
        conversationId: dto.conversationId,
        runType: 'debug-render',
        query,
        promptVersion: promptDefinition.versionedId,
        topK,
        retrievalProvider,
        retrievalNamespace: 'production',
        retrievalSource: 'production',
        promptSnapshot: {
          basePromptId: promptDefinition.id,
          systemPrompt: promptDefinition.systemPrompt,
          contextTemplate: promptDefinition.contextTemplate,
          versionLabel: promptDefinition.version,
        },
        retrievalHits,
        latencyMs: Date.now() - startedAt,
        status: 'success',
      });

      return {
        query,
        topK,
        promptVersion: promptDefinition.versionedId,
        retrievalProvider,
        retrievedCount: retrievalHits.length,
        retrievalHits,
        promptInput: {
          context,
          historyCount: historyItems.length,
        },
        promptOutput: rendered,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      await this.recordDebugRun({
        userId,
        knowledgeBaseId,
        conversationId: dto.conversationId,
        runType: 'debug-render',
        query,
        promptVersion: promptDefinition.versionedId,
        topK,
        retrievalProvider: retrievalProvider.length > 0 ? retrievalProvider : undefined,
        retrievalNamespace: 'production',
        retrievalSource: 'production',
        promptSnapshot: {
          basePromptId: promptDefinition.id,
          systemPrompt: promptDefinition.systemPrompt,
          contextTemplate: promptDefinition.contextTemplate,
          versionLabel: promptDefinition.version,
        },
        retrievalHits,
        latencyMs: Date.now() - startedAt,
        status: 'error',
        errorCode: this.resolveErrorCode(error),
      });

      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to render prompt debug info');
    }
  }

  async debugRetrieve(userId: string, dto: RetrieveRagDebugDto): Promise<{
    query: string;
    topK: number;
    promptVersion: string;
    retrievalProvider: string;
    retrievedCount: number;
    retrievalHits: ReturnType<typeof mapRetrievedChunksToRunHits>;
    latencyMs: number;
  }> {
    this.assertDebugEnabled();
    const query = dto.query.trim();
    if (query.length === 0) {
      throw new BadRequestException('query must not be empty');
    }

    const topK = dto.topK ?? getRagRetrievalConfig().topKDefault;
    const promptDefinition = this.promptRegistry.getCurrent();
    const startedAt = Date.now();
    const knowledgeBaseId = dto.knowledgeBaseId;
    let retrievalProvider = '';
    let retrievalHits = mapRetrievedChunksToRunHits([]);

    try {
      const embedding = await this.embeddingsFactory.createEmbeddings().embedQuery(query);
      const retrievalOutput =
        await this.ragRetrievalService.retrieveTopKByUserWithProvider(
          userId,
          knowledgeBaseId,
          embedding,
          topK,
        );
      retrievalProvider = retrievalOutput.provider;
      retrievalHits = mapRetrievedChunksToRunHits(retrievalOutput.chunks);

      await this.recordDebugRun({
        userId,
        knowledgeBaseId,
        runType: 'debug-retrieve',
        query,
        promptVersion: promptDefinition.versionedId,
        topK,
        retrievalProvider,
        retrievalNamespace: 'production',
        retrievalSource: 'production',
        promptSnapshot: {
          basePromptId: promptDefinition.id,
          systemPrompt: promptDefinition.systemPrompt,
          contextTemplate: promptDefinition.contextTemplate,
          versionLabel: promptDefinition.version,
        },
        retrievalHits,
        latencyMs: Date.now() - startedAt,
        status: 'success',
      });

      return {
        query,
        topK,
        promptVersion: promptDefinition.versionedId,
        retrievalProvider,
        retrievedCount: retrievalHits.length,
        retrievalHits,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      await this.recordDebugRun({
        userId,
        knowledgeBaseId,
        runType: 'debug-retrieve',
        query,
        promptVersion: promptDefinition.versionedId,
        topK,
        retrievalProvider: retrievalProvider.length > 0 ? retrievalProvider : undefined,
        retrievalNamespace: 'production',
        retrievalSource: 'production',
        promptSnapshot: {
          basePromptId: promptDefinition.id,
          systemPrompt: promptDefinition.systemPrompt,
          contextTemplate: promptDefinition.contextTemplate,
          versionLabel: promptDefinition.version,
        },
        retrievalHits,
        latencyMs: Date.now() - startedAt,
        status: 'error',
        errorCode: this.resolveErrorCode(error),
      });

      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to execute retrieval debug');
    }
  }

  async findRuns(userId: string, query: GetRagRunsQueryDto): Promise<{
    items: Array<{
      runId: string;
      runType: RagRunType;
      experimentId?: string;
      query: string;
      promptVersion: string;
      topK?: number;
      retrievalProvider?: string;
      retrievalNamespace?: string;
      retrievalSource?: 'production' | 'experiment';
      comparisonKey?: string;
      promptSnapshot?: {
        basePromptId: string;
        systemPrompt: string;
        contextTemplate: string;
        versionLabel?: string;
      };
      chunkStrategySnapshot?: {
        name: string;
        type: 'recursive' | 'markdown' | 'token';
        chunkSize: number;
        chunkOverlap: number;
        preserveSentenceBoundary: boolean;
        separators: string[];
        maxSentenceMerge?: number;
        versionLabel?: string;
      };
      retrievalHits: ReturnType<typeof mapRetrievedChunksToRunHits>;
      latencyMs: number;
      status: RagRunStatus;
      errorCode?: string;
      createdAt: Date;
    }>;
    limit: number;
    offset: number;
  }> {
    this.assertDebugEnabled();
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const userObjectId = this.toObjectId(userId);
    const conditions: {
      userId: Types.ObjectId;
      knowledgeBaseId: Types.ObjectId;
      runType?: RagRunType;
      status?: RagRunStatus;
    } = {
      userId: userObjectId,
      knowledgeBaseId: this.toObjectId(query.knowledgeBaseId),
    };

    if (query.runType) {
      conditions.runType = query.runType;
    }
    if (query.status) {
      conditions.status = query.status;
    }

    const rows = await this.ragRunModel
      .find(conditions)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .exec();

    return {
      items: rows.map(
        (row) => ({
          runId: row.id,
          runType: row.runType,
          experimentId: row.experimentId?.toString(),
          query: row.query,
          promptVersion: row.promptVersion,
          topK: row.topK,
          retrievalProvider: row.retrievalProvider,
          retrievalNamespace: row.retrievalNamespace,
          retrievalSource: row.retrievalSource,
          comparisonKey: row.comparisonKey,
          promptSnapshot: row.promptSnapshot,
          chunkStrategySnapshot: row.chunkStrategySnapshot,
          retrievalHits: row.retrievalHits,
          latencyMs: row.latencyMs,
          status: row.status,
          errorCode: row.errorCode,
          createdAt: row.createdAt,
        }),
      ),
      limit,
      offset,
    };
  }

  async findRunById(userId: string, runId: string): Promise<{
    runId: string;
    runType: RagRunType;
    experimentId?: string;
    query: string;
    promptVersion: string;
    topK?: number;
    retrievalProvider?: string;
    retrievalNamespace?: string;
    retrievalSource?: 'production' | 'experiment';
    comparisonKey?: string;
    promptSnapshot?: PromptDraft;
    chunkStrategySnapshot?: ChunkStrategyDraft;
    retrievalHits: ReturnType<typeof mapRetrievedChunksToRunHits>;
    latencyMs: number;
    status: RagRunStatus;
    errorCode?: string;
    createdAt: Date;
  }> {
    this.assertDebugEnabled();
    const row = await this.ragRunModel
      .findOne({
        _id: this.toObjectId(runId),
        userId: this.toObjectId(userId),
      })
      .exec();

    if (!row) {
      throw new NotFoundException('Run not found');
    }

    return {
      runId: row.id,
      runType: row.runType,
      experimentId: row.experimentId?.toString(),
      query: row.query,
      promptVersion: row.promptVersion,
      topK: row.topK,
      retrievalProvider: row.retrievalProvider,
      retrievalNamespace: row.retrievalNamespace,
      retrievalSource: row.retrievalSource,
      comparisonKey: row.comparisonKey,
      promptSnapshot: row.promptSnapshot,
      chunkStrategySnapshot: row.chunkStrategySnapshot,
      retrievalHits: row.retrievalHits,
      latencyMs: row.latencyMs,
      status: row.status,
      errorCode: row.errorCode,
      createdAt: row.createdAt,
    };
  }

  private assertDebugEnabled(): void {
    const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
    const flag = (process.env.RAG_DEBUG_ENABLED ?? '').trim().toLowerCase();
    const enabledByFlag = flag === 'true' || flag === '1' || flag === 'yes';
    const enabled = nodeEnv === 'development' || nodeEnv === 'test' || enabledByFlag;

    if (!enabled) {
      throw new NotFoundException('Not Found');
    }
  }

  private async findRecentHistory(
    userId: string,
    conversationId: string,
    limit: number,
  ): Promise<HistoryMessageItem[]> {
    await this.conversationsService.ensureOwnedConversation(userId, conversationId);
    const rows = await this.messageModel
      .find({
        userId: this.toObjectId(userId),
        conversationId: this.toObjectId(conversationId),
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    return rows
      .reverse()
      .map(
        (message): HistoryMessageItem => ({
          role: message.role,
          content: message.content,
        }),
      );
  }

  private async recordDebugRun(input: {
    userId: string;
    knowledgeBaseId: string;
    conversationId?: string;
    runType: RagRunType;
    query: string;
    promptVersion: string;
    topK?: number;
    retrievalProvider?: string;
    experimentId?: string;
    retrievalNamespace?: string;
    retrievalSource?: 'production' | 'experiment';
    comparisonKey?: string;
    promptSnapshot?: PromptDraft;
    chunkStrategySnapshot?: ChunkStrategyDraft;
    retrievalHits: ReturnType<typeof mapRetrievedChunksToRunHits>;
    latencyMs: number;
    status: RagRunStatus;
    errorCode?: string;
  }): Promise<void> {
    await this.ragRunRecorder.record(input);
  }

  private withCurrentQuery(
    historyItems: HistoryMessageItem[],
    query: string,
  ): HistoryMessageItem[] {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 0) {
      return historyItems;
    }

    const lastItem = historyItems.at(-1);
    if (
      lastItem &&
      lastItem.role === MessageRoleEnum.User &&
      lastItem.content.trim() === normalizedQuery
    ) {
      return historyItems;
    }

    return [
      ...historyItems,
      {
        role: MessageRoleEnum.User,
        content: normalizedQuery,
      },
    ];
  }

  private resolveErrorCode(error: Error | HttpException): string {
    if (error instanceof HttpException) {
      return `HTTP_${error.getStatus()}`;
    }

    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message.trim().slice(0, 100);
    }

    return 'RAG_DEBUG_ERROR';
  }

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }
    return new Types.ObjectId(value);
  }
}
