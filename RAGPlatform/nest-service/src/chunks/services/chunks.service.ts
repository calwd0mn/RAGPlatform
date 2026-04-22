import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Document,
  DocumentDocument,
} from '../../documents/schemas/document.schema';
import { IngestionEmbeddingsFactory } from '../../ingestion/embeddings/embeddings.factory';
import { Chunk, ChunkDocument } from '../../ingestion/schemas/chunk.schema';
import {
  DebugExperimentChunk,
  DebugExperimentChunkDocument,
} from '../../schemas/debug-experiment-chunk.schema';
import {
  ChunkContextItem,
  ChunkContextResponse,
} from '../interfaces/chunk-context-response.interface';
import {
  ChunkDebugItem,
  ChunksDebugResponse,
} from '../interfaces/chunks-debug-response.interface';

const DEFAULT_CONTEXT_WINDOW = 1;
const DEFAULT_DEBUG_LIMIT = 20;
const CONTENT_PREVIEW_LIMIT = 240;

type ChunkReadDocument = ChunkDocument | DebugExperimentChunkDocument;
type ChunkDebugBaseQuery = {
  userId: Types.ObjectId;
  knowledgeBaseId: Types.ObjectId;
  experimentId?: Types.ObjectId;
  strategyName?: string;
  documentId?: Types.ObjectId;
  'metadata.page'?: number;
  content?: { $regex: string; $options: string };
};

@Injectable()
export class ChunksService {
  constructor(
    @InjectModel(Chunk.name)
    private readonly chunkModel: Model<ChunkDocument>,
    @InjectModel(DebugExperimentChunk.name)
    private readonly debugExperimentChunkModel: Model<DebugExperimentChunkDocument>,
    @InjectModel(Document.name)
    private readonly documentModel: Model<DocumentDocument>,
    private readonly embeddingsFactory: IngestionEmbeddingsFactory,
  ) {}

  async findDebugChunks(input: {
    userId: string;
    knowledgeBaseId: string;
    experimentId?: string;
    strategyName?: string;
    documentId?: string;
    page?: number;
    keyword?: string;
    query?: string;
    limit?: number;
    offset?: number;
  }): Promise<ChunksDebugResponse> {
    const userObjectId = this.toObjectId(input.userId);
    const knowledgeBaseObjectId = this.toObjectId(input.knowledgeBaseId);
    const isExperimentQuery = Boolean(input.experimentId);
    const limit = input.limit ?? DEFAULT_DEBUG_LIMIT;
    const offset = input.offset ?? 0;
    const baseQuery: ChunkDebugBaseQuery = {
      userId: userObjectId,
      knowledgeBaseId: knowledgeBaseObjectId,
    };

    if (input.documentId) {
      baseQuery.documentId = this.toObjectId(input.documentId);
    }
    if (input.experimentId) {
      baseQuery.experimentId = this.toObjectId(input.experimentId);
    }
    if (input.strategyName) {
      baseQuery.strategyName = input.strategyName.trim();
    }
    if (input.page !== undefined) {
      baseQuery['metadata.page'] = input.page;
    }
    if (input.keyword && input.keyword.trim().length > 0) {
      const escapedKeyword = this.escapeRegex(input.keyword.trim());
      baseQuery.content = {
        $regex: escapedKeyword,
        $options: 'i',
      };
    }

    let queryEmbedding: number[] | null = null;
    if (input.query && input.query.trim().length > 0) {
      try {
        queryEmbedding = await this.embeddingsFactory
          .createEmbeddings()
          .embedQuery(input.query.trim());
      } catch {
        throw new InternalServerErrorException(
          'Failed to generate query embedding',
        );
      }
    }

    const { rows, total } = await this.queryDebugRowsAndTotal({
      isExperimentQuery,
      baseQuery,
      limit,
      offset,
    });

    const documentMap = await this.loadDocumentNameMap(
      rows.map((row): string => row.documentId.toString()),
    );
    const items = rows.map(
      (row): ChunkDebugItem => ({
        chunkId: row._id.toString(),
        documentId: row.documentId.toString(),
        documentName:
          documentMap.get(row.documentId.toString()) ??
          row.metadata?.originalName ??
          row.metadata?.source ??
          'unknown',
        page: row.metadata?.page,
        order: row.chunkIndex,
        score:
          queryEmbedding === null
            ? undefined
            : this.cosineSimilarity(queryEmbedding, row.embedding),
        contentPreview: this.toContentPreview(row.content),
        retrievalSource: isExperimentQuery ? 'experiment' : 'production',
        retrievalNamespace:
          isExperimentQuery &&
          'chunkNamespace' in row &&
          typeof row.chunkNamespace === 'string'
            ? row.chunkNamespace
            : 'production',
        strategyName:
          isExperimentQuery &&
          'strategyName' in row &&
          typeof row.strategyName === 'string'
            ? row.strategyName
            : undefined,
      }),
    );

    return {
      items,
      total,
      limit,
      offset,
    };
  }

  async getChunkContext(input: {
    userId: string;
    knowledgeBaseId: string;
    chunkId: string;
    experimentId?: string;
    before?: number;
    after?: number;
  }): Promise<ChunkContextResponse> {
    const normalizedUserId = this.toObjectId(input.userId);
    const normalizedKnowledgeBaseId = this.toObjectId(input.knowledgeBaseId);
    const normalizedChunkId = this.toObjectId(input.chunkId);
    const before = input.before ?? DEFAULT_CONTEXT_WINDOW;
    const after = input.after ?? DEFAULT_CONTEXT_WINDOW;

    const current = input.experimentId
      ? await this.debugExperimentChunkModel
          .findOne({
            _id: normalizedChunkId,
            userId: normalizedUserId,
            knowledgeBaseId: normalizedKnowledgeBaseId,
            experimentId: this.toObjectId(input.experimentId),
          })
          .select({
            _id: 1,
            documentId: 1,
            chunkIndex: 1,
            content: 1,
            metadata: 1,
          })
          .exec()
      : await this.chunkModel
          .findOne({
            _id: normalizedChunkId,
            userId: normalizedUserId,
            knowledgeBaseId: normalizedKnowledgeBaseId,
          })
          .select({
            _id: 1,
            documentId: 1,
            chunkIndex: 1,
            content: 1,
            metadata: 1,
          })
          .exec();

    if (!current) {
      throw new NotFoundException('Chunk not found');
    }

    const previous: ChunkReadDocument[] =
      before > 0
        ? input.experimentId
          ? await this.debugExperimentChunkModel
              .find({
                userId: normalizedUserId,
                knowledgeBaseId: normalizedKnowledgeBaseId,
                documentId: current.documentId,
                experimentId: this.toObjectId(input.experimentId),
                chunkIndex: { $lt: current.chunkIndex },
              })
              .select({
                _id: 1,
                documentId: 1,
                chunkIndex: 1,
                content: 1,
                metadata: 1,
              })
              .sort({ chunkIndex: -1 })
              .limit(before)
              .exec()
          : await this.chunkModel
              .find({
                userId: normalizedUserId,
                knowledgeBaseId: normalizedKnowledgeBaseId,
                documentId: current.documentId,
                chunkIndex: { $lt: current.chunkIndex },
              })
              .select({
                _id: 1,
                documentId: 1,
                chunkIndex: 1,
                content: 1,
                metadata: 1,
              })
              .sort({ chunkIndex: -1 })
              .limit(before)
              .exec()
        : [];
    const next: ChunkReadDocument[] =
      after > 0
        ? input.experimentId
          ? await this.debugExperimentChunkModel
              .find({
                userId: normalizedUserId,
                knowledgeBaseId: normalizedKnowledgeBaseId,
                documentId: current.documentId,
                experimentId: this.toObjectId(input.experimentId),
                chunkIndex: { $gt: current.chunkIndex },
              })
              .select({
                _id: 1,
                documentId: 1,
                chunkIndex: 1,
                content: 1,
                metadata: 1,
              })
              .sort({ chunkIndex: 1 })
              .limit(after)
              .exec()
          : await this.chunkModel
              .find({
                userId: normalizedUserId,
                knowledgeBaseId: normalizedKnowledgeBaseId,
                documentId: current.documentId,
                chunkIndex: { $gt: current.chunkIndex },
              })
              .select({
                _id: 1,
                documentId: 1,
                chunkIndex: 1,
                content: 1,
                metadata: 1,
              })
              .sort({ chunkIndex: 1 })
              .limit(after)
              .exec()
        : [];
    const documentMap = await this.loadDocumentNameMap([
      current.documentId.toString(),
    ]);

    return {
      current: this.toContextItem(current, documentMap),
      previous: previous
        .reverse()
        .map((item): ChunkContextItem => this.toContextItem(item, documentMap)),
      next: next.map(
        (item): ChunkContextItem => this.toContextItem(item, documentMap),
      ),
    };
  }

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }
    return new Types.ObjectId(value);
  }

  private async queryDebugRowsAndTotal(input: {
    isExperimentQuery: boolean;
    baseQuery: ChunkDebugBaseQuery;
    limit: number;
    offset: number;
  }): Promise<{ rows: ChunkReadDocument[]; total: number }> {
    const projection = {
      _id: 1,
      documentId: 1,
      chunkIndex: 1,
      chunkNamespace: 1,
      strategyName: 1,
      content: 1,
      embedding: 1,
      metadata: 1,
    };

    if (input.isExperimentQuery) {
      const [rows, total] = await Promise.all([
        this.debugExperimentChunkModel
          .find(input.baseQuery)
          .sort({ createdAt: -1 })
          .skip(input.offset)
          .limit(input.limit)
          .select(projection)
          .exec(),
        this.debugExperimentChunkModel.countDocuments(input.baseQuery).exec(),
      ]);

      return {
        rows,
        total,
      };
    }

    const [rows, total] = await Promise.all([
      this.chunkModel
        .find(input.baseQuery)
        .sort({ createdAt: -1 })
        .skip(input.offset)
        .limit(input.limit)
        .select(projection)
        .exec(),
      this.chunkModel.countDocuments(input.baseQuery).exec(),
    ]);

    return {
      rows,
      total,
    };
  }

  private async loadDocumentNameMap(
    documentIds: string[],
  ): Promise<Map<string, string>> {
    const uniqueIds = Array.from(new Set(documentIds))
      .filter((value): boolean => Types.ObjectId.isValid(value))
      .map((value): Types.ObjectId => new Types.ObjectId(value));
    if (uniqueIds.length === 0) {
      return new Map<string, string>();
    }

    const rows = await this.documentModel
      .find({ _id: { $in: uniqueIds } })
      .select({ _id: 1, originalName: 1 })
      .exec();

    return new Map<string, string>(
      rows.map((row): [string, string] => [
        row._id.toString(),
        row.originalName,
      ]),
    );
  }

  private toContentPreview(content: string): string {
    const compacted = content.replace(/\s+/g, ' ').trim();
    if (compacted.length <= CONTENT_PREVIEW_LIMIT) {
      return compacted;
    }
    return `${compacted.slice(0, CONTENT_PREVIEW_LIMIT)}...`;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private cosineSimilarity(left: number[], right: number[]): number {
    if (
      left.length === 0 ||
      right.length === 0 ||
      left.length !== right.length
    ) {
      return 0;
    }

    let dotProduct = 0;
    let leftNorm = 0;
    let rightNorm = 0;

    for (let index = 0; index < left.length; index += 1) {
      const leftValue = left[index];
      const rightValue = right[index];
      dotProduct += leftValue * rightValue;
      leftNorm += leftValue * leftValue;
      rightNorm += rightValue * rightValue;
    }

    if (leftNorm === 0 || rightNorm === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
  }

  private toContextItem(
    chunk: ChunkDocument | DebugExperimentChunkDocument,
    documentMap: Map<string, string>,
  ): ChunkContextItem {
    const documentId = chunk.documentId.toString();
    return {
      chunkId: chunk._id.toString(),
      documentId,
      documentName:
        documentMap.get(documentId) ??
        chunk.metadata?.originalName ??
        chunk.metadata?.source,
      order: chunk.chunkIndex,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      contentPreview: this.toContentPreview(chunk.content),
      page: chunk.metadata?.page,
    };
  }
}
