import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Document,
  DocumentDocument,
} from '../../documents/schemas/document.schema';
import { Chunk, ChunkDocument } from '../../ingestion/schemas/chunk.schema';
import {
  ChunkContextItem,
  ChunkContextResponse,
} from '../interfaces/chunk-context-response.interface';

const DEFAULT_CONTEXT_WINDOW = 1;
const CONTENT_PREVIEW_LIMIT = 240;

@Injectable()
export class ChunksService {
  constructor(
    @InjectModel(Chunk.name)
    private readonly chunkModel: Model<ChunkDocument>,
    @InjectModel(Document.name)
    private readonly documentModel: Model<DocumentDocument>,
  ) {}

  async getChunkContext(input: {
    userId: string;
    knowledgeBaseId: string;
    chunkId: string;
    before?: number;
    after?: number;
  }): Promise<ChunkContextResponse> {
    const normalizedUserId = this.toObjectId(input.userId);
    const normalizedKnowledgeBaseId = this.toObjectId(input.knowledgeBaseId);
    const normalizedChunkId = this.toObjectId(input.chunkId);
    const before = input.before ?? DEFAULT_CONTEXT_WINDOW;
    const after = input.after ?? DEFAULT_CONTEXT_WINDOW;

    const current = await this.chunkModel
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

    const previous: ChunkDocument[] =
      before > 0
        ? await this.chunkModel
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
    const next: ChunkDocument[] =
      after > 0
        ? await this.chunkModel
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

  private toContextItem(
    chunk: ChunkDocument,
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
