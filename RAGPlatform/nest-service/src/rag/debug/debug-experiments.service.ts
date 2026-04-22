import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { Document as LangChainDocument } from '@langchain/core/documents';
import { Model, Types } from 'mongoose';
import {
  Document,
  DocumentDocument,
} from '../../documents/schemas/document.schema';
import { Chunk, ChunkDocument } from '../../ingestion/schemas/chunk.schema';
import { ChunkMetadataBuilder } from '../../ingestion/builders/chunk-metadata.builder';
import { IngestionEmbeddingsFactory } from '../../ingestion/embeddings/embeddings.factory';
import { DocumentLoaderFactory } from '../../ingestion/loaders/document-loader.factory';
import { LangchainDocumentMapper } from '../../ingestion/mappers/langchain-document.mapper';
import { TextSplitterFactory } from '../../ingestion/splitters/text-splitter.factory';
import {
  DebugExperiment,
  DebugExperimentDocument,
  ChunkStrategyDraft,
  DebugExperimentStatus,
  PromptDraft,
} from '../../schemas/debug-experiment.schema';
import {
  DebugExperimentChunk,
  DebugExperimentChunkDocument,
} from '../../schemas/debug-experiment-chunk.schema';
import { mapRetrievedChunksToRunHits } from './utils/map-retrieval-hits.util';
import { RagContextBuilder } from '../builders/rag-context.builder';
import { RagChatModelFactory } from '../factories/rag-chat-model.factory';
import { RetrievedChunk } from '../interfaces/retrieved-chunk.interface';
import { ChunkToCitationMapper } from '../mappers/chunk-to-citation.mapper';
import { MessageHistoryMapper } from '../mappers/message-history.mapper';
import { PromptRenderer } from '../prompt/prompt-renderer';
import { PromptRegistry } from '../prompt/prompt-registry';
import { DebugExperimentRetrievalProvider } from '../retrievers/providers/debug-experiment-retrieval.provider';
import {
  CreateDebugExperimentDto,
  UpdateDebugExperimentDto,
} from './dto/create-debug-experiment.dto';
import { GetDebugExperimentsQueryDto } from './dto/get-debug-experiments-query.dto';
import { PublishDebugExperimentDto } from './dto/publish-debug-experiment.dto';
import { RagRunRecorderService } from './rag-run-recorder.service';
import { KnowledgeBasesService } from '../../knowledge-bases/knowledge-bases.service';

const DEFAULT_LIMIT = 20;
const ANSWER_PREVIEW_LIMIT = 240;

interface ExperimentQueryRunResult {
  query: string;
  retrievedCount: number;
  retrievalHits: ReturnType<typeof mapRetrievedChunksToRunHits>;
  citationsCount: number;
  promptOutput: {
    messages: { role: string; content: string }[];
    promptText: string;
  };
  answerPreview?: string;
}

interface StrategyExecutionResult {
  strategyName: string;
  retrievalNamespace: string;
  chunkCount: number;
  avgLength: number;
  results: ExperimentQueryRunResult[];
}

@Injectable()
export class DebugExperimentsService {
  constructor(
    @InjectModel(DebugExperiment.name)
    private readonly debugExperimentModel: Model<DebugExperimentDocument>,
    @InjectModel(DebugExperimentChunk.name)
    private readonly debugExperimentChunkModel: Model<DebugExperimentChunkDocument>,
    @InjectModel(Document.name)
    private readonly documentModel: Model<DocumentDocument>,
    @InjectModel(Chunk.name)
    private readonly chunkModel: Model<ChunkDocument>,
    private readonly documentLoaderFactory: DocumentLoaderFactory,
    private readonly textSplitterFactory: TextSplitterFactory,
    private readonly embeddingsFactory: IngestionEmbeddingsFactory,
    private readonly langchainDocumentMapper: LangchainDocumentMapper,
    private readonly chunkMetadataBuilder: ChunkMetadataBuilder,
    private readonly experimentRetrievalProvider: DebugExperimentRetrievalProvider,
    private readonly ragContextBuilder: RagContextBuilder,
    private readonly chunkToCitationMapper: ChunkToCitationMapper,
    private readonly ragChatModelFactory: RagChatModelFactory,
    private readonly promptRegistry: PromptRegistry,
    private readonly promptRenderer: PromptRenderer,
    private readonly messageHistoryMapper: MessageHistoryMapper,
    private readonly ragRunRecorder: RagRunRecorderService,
    private readonly knowledgeBasesService: KnowledgeBasesService,
  ) {}

  async createExperiment(
    userId: string,
    dto: CreateDebugExperimentDto,
  ): Promise<DebugExperimentDocument> {
    await this.knowledgeBasesService.assertOwnedKnowledgeBase(
      userId,
      dto.knowledgeBaseId,
    );
    const currentPrompt = this.promptRegistry.getCurrent();
    const chunkNamespace = `exp-${new Types.ObjectId().toString()}`;
    const experiment = new this.debugExperimentModel({
      userId: this.toObjectId(userId),
      knowledgeBaseId: this.toObjectId(dto.knowledgeBaseId),
      scope: dto.scope ?? 'manual',
      documentIds: this.normalizeObjectIds(dto.documentIds ?? []),
      queries: this.normalizeQueries(dto.queries),
      promptDraft: {
        basePromptId: dto.promptDraft.basePromptId ?? currentPrompt.id,
        systemPrompt: dto.promptDraft.systemPrompt,
        contextTemplate: dto.promptDraft.contextTemplate,
        versionLabel: dto.promptDraft.versionLabel,
      },
      chunkStrategyDrafts: this.normalizeStrategies(dto.chunkStrategyDrafts),
      topK: dto.topK,
      mode: dto.mode,
      status: 'draft',
      chunkNamespace,
    });

    return experiment.save();
  }

  async updateExperiment(
    userId: string,
    experimentId: string,
    dto: UpdateDebugExperimentDto,
  ): Promise<DebugExperimentDocument> {
    const experiment = await this.findOwnedExperiment(userId, experimentId);
    if (experiment.status === 'published') {
      throw new BadRequestException('Published experiment cannot be updated');
    }

    if (dto.documentIds) {
      experiment.documentIds = this.normalizeObjectIds(dto.documentIds);
    }
    if (dto.knowledgeBaseId) {
      await this.knowledgeBasesService.assertOwnedKnowledgeBase(
        userId,
        dto.knowledgeBaseId,
      );
      experiment.knowledgeBaseId = this.toObjectId(dto.knowledgeBaseId);
    }
    if (dto.queries) {
      experiment.queries = this.normalizeQueries(dto.queries);
    }
    if (dto.promptDraft) {
      experiment.promptDraft = {
        basePromptId: dto.promptDraft.basePromptId,
        systemPrompt: dto.promptDraft.systemPrompt,
        contextTemplate: dto.promptDraft.contextTemplate,
        versionLabel: dto.promptDraft.versionLabel,
      };
    }
    if (dto.chunkStrategyDrafts) {
      experiment.chunkStrategyDrafts = this.normalizeStrategies(
        dto.chunkStrategyDrafts,
      );
    }
    if (dto.topK !== undefined) {
      experiment.topK = dto.topK;
    }
    if (dto.mode) {
      experiment.mode = dto.mode;
    }
    experiment.status = 'draft';
    experiment.lastError = undefined;

    return experiment.save();
  }

  async findExperiments(
    userId: string,
    query: GetDebugExperimentsQueryDto,
  ): Promise<{
    items: DebugExperimentDocument[];
    limit: number;
    offset: number;
  }> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const offset = query.offset ?? 0;
    const conditions: {
      userId: Types.ObjectId;
      knowledgeBaseId: Types.ObjectId;
      status?: DebugExperimentStatus;
    } = {
      userId: this.toObjectId(userId),
      knowledgeBaseId: this.toObjectId(query.knowledgeBaseId),
    };
    if (query.status) {
      conditions.status = query.status;
    }

    const items = await this.debugExperimentModel
      .find(conditions)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .exec();

    return { items, limit, offset };
  }

  async findExperimentById(
    userId: string,
    experimentId: string,
  ): Promise<DebugExperimentDocument> {
    return this.findOwnedExperiment(userId, experimentId);
  }

  async runExperiment(
    userId: string,
    experimentId: string,
  ): Promise<{
    experimentId: string;
    status: DebugExperimentStatus;
    topK: number;
    mode: 'retrieve-only' | 'full-rag';
    promptSnapshot: PromptDraft;
    strategies: StrategyExecutionResult[];
  }> {
    const experiment = await this.findOwnedExperiment(userId, experimentId);
    experiment.status = 'running';
    experiment.lastError = undefined;
    await experiment.save();

    try {
      await this.debugExperimentChunkModel
        .deleteMany({
          userId: this.toObjectId(userId),
          experimentId: experiment._id,
        })
        .exec();

      const strategyResults: StrategyExecutionResult[] = [];
      const promptDefinition = this.promptRegistry.resolveDraft(
        experiment.promptDraft,
      );
      const embeddings = this.embeddingsFactory.createEmbeddings();

      for (const strategy of experiment.chunkStrategyDrafts) {
        const ingestionResult = await this.ingestExperimentChunks({
          userId,
          experiment,
          strategy,
        });

        const queryResults: ExperimentQueryRunResult[] = [];
        for (const query of experiment.queries) {
          const queryEmbedding = await embeddings.embedQuery(query);
          const retrievedChunks =
            await this.experimentRetrievalProvider.retrieveTopKByExperiment({
              userId,
              knowledgeBaseId: experiment.knowledgeBaseId.toString(),
              experimentId: experiment.id,
              strategyName: strategy.name,
              queryEmbedding,
              topK: experiment.topK,
            });

          const context = this.ragContextBuilder.build(retrievedChunks);
          const promptOutput = await this.promptRenderer.render({
            definition: promptDefinition,
            context,
            history: this.messageHistoryMapper.toLangchainMessages([]),
            question: query,
          });

          const citations = retrievedChunks.map((chunk) =>
            this.chunkToCitationMapper.map(chunk),
          );

          let answerPreview: string | undefined;
          if (experiment.mode === 'full-rag') {
            const answer = await this.generateAnswer({
              query,
              retrievedChunks,
              promptDraft: experiment.promptDraft,
            });
            answerPreview = this.toAnswerPreview(answer);
          }

          const retrievalHits = mapRetrievedChunksToRunHits(retrievedChunks);
          queryResults.push({
            query,
            retrievedCount: retrievedChunks.length,
            retrievalHits,
            citationsCount: citations.length,
            promptOutput,
            answerPreview,
          });

          await this.ragRunRecorder.record({
            userId,
            knowledgeBaseId: experiment.knowledgeBaseId.toString(),
            experimentId: experiment.id,
            runType: 'debug-render',
            query,
            promptVersion: promptDefinition.versionedId,
            topK: experiment.topK,
            retrievalProvider: 'debug-experiment-local',
            retrievalNamespace: experiment.chunkNamespace,
            retrievalSource: 'experiment',
            comparisonKey: `${experiment.id}:${strategy.name}:${query}`,
            promptSnapshot: experiment.promptDraft,
            chunkStrategySnapshot: strategy,
            retrievalHits,
            latencyMs: 0,
            status: 'success',
          });
        }

        strategyResults.push({
          strategyName: strategy.name,
          retrievalNamespace: experiment.chunkNamespace,
          chunkCount: ingestionResult.chunkCount,
          avgLength: ingestionResult.avgLength,
          results: queryResults,
        });
      }

      experiment.status = 'completed';
      await experiment.save();

      return {
        experimentId: experiment.id,
        status: experiment.status,
        topK: experiment.topK,
        mode: experiment.mode,
        promptSnapshot: experiment.promptDraft,
        strategies: strategyResults,
      };
    } catch (error) {
      experiment.status = 'failed';
      experiment.lastError = this.extractErrorMessage(error);
      await experiment.save();
      throw error;
    }
  }

  async publishExperiment(
    userId: string,
    experimentId: string,
    dto: PublishDebugExperimentDto,
  ): Promise<{ experimentId: string; publishedStrategyName: string }> {
    const experiment = await this.findOwnedExperiment(userId, experimentId);
    if (experiment.chunkStrategyDrafts.length === 0) {
      throw new BadRequestException('No strategy available to publish');
    }

    const strategyName =
      dto.strategyName?.trim() || experiment.chunkStrategyDrafts[0]?.name || '';
    if (strategyName.length === 0) {
      throw new BadRequestException('strategyName is required');
    }

    const strategy = experiment.chunkStrategyDrafts.find(
      (item): boolean => item.name === strategyName,
    );
    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }

    const chunks = await this.debugExperimentChunkModel
      .find({
        userId: this.toObjectId(userId),
        knowledgeBaseId: experiment.knowledgeBaseId,
        experimentId: experiment._id,
        strategyName,
      })
      .sort({ documentId: 1, chunkIndex: 1 })
      .exec();

    if (chunks.length === 0) {
      throw new BadRequestException(
        'Experiment has no generated chunks to publish',
      );
    }

    const documentIds = Array.from(
      new Set(chunks.map((item): string => item.documentId.toString())),
    ).map((value): Types.ObjectId => new Types.ObjectId(value));

    await this.chunkModel
      .deleteMany({
        userId: this.toObjectId(userId),
        documentId: { $in: documentIds },
      })
      .exec();

    const payload = chunks.map(
      (chunk): Partial<Chunk> => ({
        userId: chunk.userId,
        knowledgeBaseId: chunk.knowledgeBaseId,
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        embedding: chunk.embedding,
        metadata: chunk.metadata,
      }),
    );
    await this.chunkModel.insertMany(payload, { ordered: true });

    const strategyVersion = strategy.versionLabel?.trim() || 'draft';
    await this.knowledgeBasesService.updateActiveStrategy({
      userId,
      knowledgeBaseId: experiment.knowledgeBaseId.toString(),
      strategyName: strategy.name,
      strategyVersion,
    });

    experiment.status = 'published';
    await experiment.save();

    return {
      experimentId: experiment.id,
      publishedStrategyName: strategy.name,
    };
  }

  private async ingestExperimentChunks(input: {
    userId: string;
    experiment: DebugExperimentDocument;
    strategy: ChunkStrategyDraft;
  }): Promise<{ chunkCount: number; avgLength: number }> {
    const documents = await this.loadExperimentDocuments({
      userId: input.userId,
      knowledgeBaseId: input.experiment.knowledgeBaseId,
      documentIds: input.experiment.documentIds.map((item): string =>
        item.toString(),
      ),
    });

    const splitter = this.textSplitterFactory.createSplitterByConfig({
      chunkSize: input.strategy.chunkSize,
      chunkOverlap: input.strategy.chunkOverlap,
      splitterType: input.strategy.type,
      preserveSentenceBoundary: input.strategy.preserveSentenceBoundary,
      separators: input.strategy.separators,
    });
    const embeddings = this.embeddingsFactory.createEmbeddings();
    const payload: Array<Partial<DebugExperimentChunk>> = [];
    let totalLength = 0;

    for (const document of documents) {
      const loadedDocuments = await this.documentLoaderFactory.load({
        storagePath: document.storagePath,
        originalName: document.originalName,
        mimeType: document.mimeType,
      });
      if (loadedDocuments.length === 0) {
        continue;
      }

      const mappedDocuments = this.langchainDocumentMapper.mapLoadedDocuments({
        loadedDocuments,
        userId: input.userId,
        documentId: document.id,
        originalName: document.originalName,
        mimeType: document.mimeType,
      });

      const chunkDocuments = await splitter.splitDocuments(mappedDocuments);
      if (chunkDocuments.length === 0) {
        continue;
      }

      const chunksForEmbedding = chunkDocuments.map(
        (
          chunkDocument: LangChainDocument,
          chunkIndex: number,
        ): LangChainDocument =>
          new LangChainDocument({
            pageContent: chunkDocument.pageContent,
            metadata: this.chunkMetadataBuilder.build({
              metadata: chunkDocument.metadata,
              originalName: document.originalName,
              mimeType: document.mimeType,
              documentId: document.id,
              userId: input.userId,
            }),
            id: `${input.experiment.id}-${input.strategy.name}-${document.id}-${chunkIndex}`,
          }),
      );

      const vectors = await embeddings.embedDocuments(
        chunksForEmbedding.map((item): string => item.pageContent),
      );
      if (vectors.length !== chunksForEmbedding.length) {
        throw new BadRequestException('Embedding result size mismatch');
      }

      chunksForEmbedding.forEach((item, index): void => {
        totalLength += item.pageContent.length;
        payload.push({
          userId: this.toObjectId(input.userId),
          knowledgeBaseId: input.experiment.knowledgeBaseId,
          documentId: this.toObjectId(document.id),
          experimentId: input.experiment._id,
          chunkNamespace: input.experiment.chunkNamespace,
          strategyName: input.strategy.name,
          strategySnapshot: input.strategy,
          chunkIndex: index,
          content: item.pageContent,
          embedding: vectors[index],
          metadata: item.metadata,
        });
      });
    }

    if (payload.length > 0) {
      await this.debugExperimentChunkModel.insertMany(payload, {
        ordered: true,
      });
    }

    const avgLength = payload.length === 0 ? 0 : totalLength / payload.length;
    return {
      chunkCount: payload.length,
      avgLength: Number(avgLength.toFixed(2)),
    };
  }

  private async loadOwnedDocuments(
    userId: string,
    knowledgeBaseId: Types.ObjectId,
    documentIds: string[],
  ): Promise<DocumentDocument[]> {
    const rows = await this.documentModel
      .find({
        _id: { $in: this.normalizeObjectIds(documentIds) },
        userId: this.toObjectId(userId),
        knowledgeBaseId,
      })
      .exec();

    if (rows.length !== new Set(documentIds).size) {
      throw new NotFoundException(
        'Some documents do not exist or are not owned by user',
      );
    }

    return rows;
  }

  private async loadExperimentDocuments(input: {
    userId: string;
    knowledgeBaseId: Types.ObjectId;
    documentIds: string[];
  }): Promise<DocumentDocument[]> {
    if (input.documentIds.length > 0) {
      return this.loadOwnedDocuments(
        input.userId,
        input.knowledgeBaseId,
        input.documentIds,
      );
    }

    const rows = await this.documentModel
      .find({
        userId: this.toObjectId(input.userId),
        knowledgeBaseId: input.knowledgeBaseId,
        status: 'ready',
      })
      .sort({ createdAt: 1 })
      .exec();

    if (rows.length === 0) {
      throw new NotFoundException(
        'No ready documents found in the selected knowledge base',
      );
    }

    return rows;
  }

  private async findOwnedExperiment(
    userId: string,
    experimentId: string,
  ): Promise<DebugExperimentDocument> {
    const row = await this.debugExperimentModel
      .findOne({
        _id: this.toObjectId(experimentId),
        userId: this.toObjectId(userId),
      })
      .exec();

    if (!row) {
      throw new NotFoundException('Experiment not found');
    }

    return row;
  }

  private normalizeObjectIds(values: string[]): Types.ObjectId[] {
    const unique = new Set<string>();
    values.forEach((value): void => {
      const normalized = value.trim();
      if (normalized.length > 0) {
        unique.add(normalized);
      }
    });

    return Array.from(
      unique,
      (value): Types.ObjectId => this.toObjectId(value),
    );
  }

  private normalizeQueries(queries: string[]): string[] {
    const normalized = queries
      .map((item): string => item.trim())
      .filter((item): boolean => item.length > 0);
    if (normalized.length === 0) {
      throw new BadRequestException('queries must not be empty');
    }
    return normalized;
  }

  private normalizeStrategies(
    strategies: Array<{
      name: string;
      type: 'recursive' | 'markdown' | 'token';
      chunkSize: number;
      chunkOverlap: number;
      preserveSentenceBoundary: boolean;
      separators?: string[];
      maxSentenceMerge?: number;
      versionLabel?: string;
    }>,
  ): ChunkStrategyDraft[] {
    const usedNames = new Set<string>();

    return strategies.map((strategy): ChunkStrategyDraft => {
      const name = strategy.name.trim();
      if (name.length === 0) {
        throw new BadRequestException('strategy name must not be empty');
      }
      if (usedNames.has(name)) {
        throw new BadRequestException(`duplicate strategy name: ${name}`);
      }
      if (strategy.chunkOverlap >= strategy.chunkSize) {
        throw new BadRequestException(
          `chunkOverlap must be smaller than chunkSize for strategy: ${name}`,
        );
      }

      usedNames.add(name);
      return {
        name,
        type: strategy.type,
        chunkSize: strategy.chunkSize,
        chunkOverlap: strategy.chunkOverlap,
        preserveSentenceBoundary: strategy.preserveSentenceBoundary,
        separators: strategy.separators ?? [],
        maxSentenceMerge: strategy.maxSentenceMerge,
        versionLabel: strategy.versionLabel,
      };
    });
  }

  private async generateAnswer(input: {
    query: string;
    retrievedChunks: RetrievedChunk[];
    promptDraft: PromptDraft;
  }): Promise<string> {
    const context = this.ragContextBuilder.build(input.retrievedChunks);
    const promptDefinition = this.promptRegistry.resolveDraft(
      input.promptDraft,
    );
    const promptTemplate = this.promptRenderer.createTemplate(promptDefinition);
    const fallbackAnswer = this.prepareFallbackAnswer(input.retrievedChunks);
    const model = await this.ragChatModelFactory.create(fallbackAnswer);
    const chain = RunnableSequence.from([
      promptTemplate,
      model,
      new StringOutputParser(),
    ]);

    try {
      const answer = await chain.invoke({
        context,
        history: this.messageHistoryMapper.toLangchainMessages([]),
        question: input.query,
      });
      return answer.trim();
    } catch {
      throw new InternalServerErrorException(
        'Failed to generate debug experiment answer',
      );
    }
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

  private toAnswerPreview(answer: string): string {
    const compacted = answer.replace(/\s+/g, ' ').trim();
    if (compacted.length <= ANSWER_PREVIEW_LIMIT) {
      return compacted;
    }
    return `${compacted.slice(0, ANSWER_PREVIEW_LIMIT)}...`;
  }

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }
    return new Types.ObjectId(value);
  }

  private extractErrorMessage(error: object): string {
    if (error instanceof Error) {
      const message = error.message.trim();
      if (message.length > 0) {
        return message.slice(0, 1000);
      }
    }
    return 'Debug experiment execution failed';
  }
}
