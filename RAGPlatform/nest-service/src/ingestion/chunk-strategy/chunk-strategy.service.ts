import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { randomUUID } from 'crypto';
import { MessageRoleEnum } from '../../messages/interfaces/message-role.type';
import { mapRetrievedChunksToRunHits } from '../../rag/debug/utils/map-retrieval-hits.util';
import { RagContextBuilder } from '../../rag/builders/rag-context.builder';
import { RagChatModelFactory } from '../../rag/factories/rag-chat-model.factory';
import { RetrievedChunk } from '../../rag/interfaces/retrieved-chunk.interface';
import { ChunkToCitationMapper } from '../../rag/mappers/chunk-to-citation.mapper';
import { MessageHistoryMapper } from '../../rag/mappers/message-history.mapper';
import { PromptRenderer } from '../../rag/prompt/prompt-renderer';
import { PromptRegistry } from '../../rag/prompt/prompt-registry';
import { getRagRetrievalConfig } from '../../rag/retrievers/config/rag-retrieval.config';
import { IngestionEmbeddingsFactory } from '../embeddings/embeddings.factory';
import { RunChunkStrategyTestDto } from './dto/run-chunk-strategy-test.dto';
import { ChunkStrategyReporter } from './chunk-strategy.reporter';
import { ChunkStrategyRunner } from './chunk-strategy.runner';
import {
  ChunkSplitterType,
  ChunkStrategyQueryHit,
  ChunkStrategyTestReport,
  ChunkStrategyTestStrategyReport,
  NormalizedChunkStrategyConfig,
} from './chunk-strategy.types';

const ANSWER_PREVIEW_LIMIT = 240;
const MIN_TOP_K = 1;
const MAX_TOP_K = 20;

@Injectable()
export class ChunkStrategyService {
  constructor(
    private readonly chunkStrategyRunner: ChunkStrategyRunner,
    private readonly chunkStrategyReporter: ChunkStrategyReporter,
    private readonly embeddingsFactory: IngestionEmbeddingsFactory,
    private readonly ragContextBuilder: RagContextBuilder,
    private readonly chunkToCitationMapper: ChunkToCitationMapper,
    private readonly ragChatModelFactory: RagChatModelFactory,
    private readonly promptRegistry: PromptRegistry,
    private readonly promptRenderer: PromptRenderer,
    private readonly messageHistoryMapper: MessageHistoryMapper,
  ) {}

  async runTest(
    userId: string,
    dto: RunChunkStrategyTestDto,
  ): Promise<ChunkStrategyTestReport> {
    const normalizedQueries = dto.queries
      .map((item): string => item.trim())
      .filter((item): boolean => item.length > 0);
    if (normalizedQueries.length === 0) {
      throw new BadRequestException('queries must not be empty');
    }

    const normalizedStrategies = this.normalizeStrategies(dto);
    const topK = this.clampTopK(
      dto.topK ?? getRagRetrievalConfig().topKDefault,
    );
    const testRunId = this.buildTestRunId();
    const strategyReports: ChunkStrategyTestStrategyReport[] = [];
    const embeddings = this.embeddingsFactory.createEmbeddings();

    for (const strategy of normalizedStrategies) {
      const ingestionResult = await this.chunkStrategyRunner.ingestByStrategy({
        userId,
        testRunId,
        documentIds: dto.documentIds,
        strategy,
      });

      const queryHits: ChunkStrategyQueryHit[] = [];
      for (const query of normalizedQueries) {
        const queryEmbedding = await embeddings.embedQuery(query);
        const retrievedChunks = await this.chunkStrategyRunner.retrieveByStrategy({
          userId,
          testRunId,
          strategyName: strategy.name,
          queryEmbedding,
          topK,
          documentIds: dto.documentIds,
        });

        const citations = retrievedChunks.map((chunk) =>
          this.chunkToCitationMapper.map(chunk),
        );

        let answerPreview: string | undefined;
        if (dto.mode === 'full-rag') {
          const answer = await this.generateAnswer({
            query,
            retrievedChunks,
          });
          answerPreview = this.toAnswerPreview(answer);
        }

        queryHits.push({
          query,
          retrievedCount: retrievedChunks.length,
          hits: mapRetrievedChunksToRunHits(retrievedChunks),
          citationsCount: citations.length,
          answerPreview,
        });
      }

      strategyReports.push(
        this.chunkStrategyReporter.buildStrategyReport({
          strategy,
          chunkCount: ingestionResult.chunkCount,
          avgLength: ingestionResult.avgLength,
          queryHits,
        }),
      );
    }

    return this.chunkStrategyReporter.buildTestReport({
      testRunId,
      mode: dto.mode,
      topK,
      documentIds: dto.documentIds,
      queryCount: normalizedQueries.length,
      strategies: strategyReports,
    });
  }

  private normalizeStrategies(
    dto: RunChunkStrategyTestDto,
  ): NormalizedChunkStrategyConfig[] {
    const usedNames = new Set<string>();
    const normalized = dto.strategies.map(
      (strategy): NormalizedChunkStrategyConfig => {
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
          chunkSize: strategy.chunkSize,
          chunkOverlap: strategy.chunkOverlap,
          splitterType: strategy.splitterType ?? this.defaultSplitterType(),
          preserveSentenceBoundary: strategy.preserveSentenceBoundary ?? false,
          separators: strategy.separators ?? [],
          maxSentenceMerge: strategy.maxSentenceMerge,
          versionLabel: strategy.versionLabel,
        };
      },
    );

    if (normalized.length === 0) {
      throw new BadRequestException('strategies must not be empty');
    }
    return normalized;
  }

  private defaultSplitterType(): ChunkSplitterType {
    const splitterType = (process.env.INGESTION_SPLITTER_TYPE ?? '')
      .trim()
      .toLowerCase();
    if (
      splitterType === 'recursive' ||
      splitterType === 'markdown' ||
      splitterType === 'token'
    ) {
      return splitterType;
    }
    return 'recursive';
  }

  private async generateAnswer(input: {
    query: string;
    retrievedChunks: RetrievedChunk[];
  }): Promise<string> {
    const context = this.ragContextBuilder.build(input.retrievedChunks);
    const promptDefinition = this.promptRegistry.getCurrent();
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
        history: this.messageHistoryMapper.toLangchainMessages([
          {
            role: MessageRoleEnum.User,
            content: input.query,
          },
        ]),
      });
      return answer.trim();
    } catch {
      throw new InternalServerErrorException(
        'Failed to generate strategy comparison answer',
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

  private buildTestRunId(): string {
    const isoTimestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
    const randomPart = randomUUID().slice(0, 8);
    return `chunk-test-${isoTimestamp}-${randomPart}`;
  }

  private clampTopK(value: number): number {
    if (value < MIN_TOP_K) {
      return MIN_TOP_K;
    }
    if (value > MAX_TOP_K) {
      return MAX_TOP_K;
    }
    return value;
  }
}
