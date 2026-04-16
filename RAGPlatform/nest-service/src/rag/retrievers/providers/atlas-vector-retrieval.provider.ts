import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChunkMetadata } from '../../../ingestion/interfaces/chunk-metadata.interface';
import { Chunk, ChunkDocument } from '../../../ingestion/schemas/chunk.schema';
import { RetrievedChunk } from '../../interfaces/retrieved-chunk.interface';
import { getRagRetrievalConfig } from '../config/rag-retrieval.config';
import { RagRetrievalProvider } from '../interfaces/rag-retrieval-provider.interface';
import { buildAtlasVectorSearchPipeline } from '../utils/build-atlas-vector-search-pipeline';

interface AtlasRetrievedChunkDocument {
  _id?: Types.ObjectId | string;
  userId?: Types.ObjectId | string;
  documentId?: Types.ObjectId | string;
  content?: string;
  metadata?: ChunkMetadata;
  score?: number;
}

interface ValidAtlasRetrievedChunkDocument {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  documentId: Types.ObjectId | string;
  content: string;
  metadata?: ChunkMetadata;
  score: number;
}

@Injectable()
export class AtlasVectorRetrievalProvider implements RagRetrievalProvider {
  readonly name = 'atlas';

  constructor(
    @InjectModel(Chunk.name)
    private readonly chunkModel: Model<ChunkDocument>,
  ) {}

  async retrieveTopKByUser(
    userId: string,
    queryEmbedding: number[],
    topK: number,
  ): Promise<RetrievedChunk[]> {
    const normalizedUserId = this.toObjectId(userId);
    if (queryEmbedding.length === 0) {
      throw new InternalServerErrorException('Query embedding is empty');
    }

    const config = getRagRetrievalConfig();
    const pipeline = buildAtlasVectorSearchPipeline({
      indexName: config.vectorIndexName,
      vectorPath: config.vectorPath,
      queryVector: queryEmbedding,
      topK,
      candidateLimit: config.vectorCandidateLimit,
      userId: normalizedUserId,
    });

    let rows: AtlasRetrievedChunkDocument[];
    try {
      rows = await this.chunkModel.aggregate<AtlasRetrievedChunkDocument>(pipeline).exec();
    } catch {
      throw new InternalServerErrorException('Atlas vector retrieval failed');
    }

    try {
      const invalidOwnedRowExists = rows.some(
        (row): boolean =>
          this.isSameUser(row.userId, normalizedUserId) && !this.isValidAtlasRow(row),
      );
      if (invalidOwnedRowExists) {
        throw new InternalServerErrorException(
          'Atlas provider returned invalid payload',
        );
      }

      const isolatedRows = rows.filter(
        (row): row is ValidAtlasRetrievedChunkDocument =>
          this.isValidAtlasRow(row) &&
          this.isSameUser(row.userId, normalizedUserId),
      );

      return isolatedRows.slice(0, topK).map(
        (row): RetrievedChunk => ({
          chunkId: row._id.toString(),
          documentId: row.documentId.toString(),
          content: row.content,
          score: row.score,
          metadata: row.metadata ?? {},
        }),
      );
    } catch {
      throw new InternalServerErrorException(
        'Atlas provider returned invalid payload',
      );
    }
  }

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }

    return new Types.ObjectId(value);
  }

  private isValidAtlasRow(
    row: AtlasRetrievedChunkDocument,
  ): row is ValidAtlasRetrievedChunkDocument {
    if (!row._id || !row.userId || !row.documentId) {
      return false;
    }

    if (typeof row.content !== 'string') {
      return false;
    }

    if (typeof row.score !== 'number' || Number.isNaN(row.score)) {
      return false;
    }

    return true;
  }

  private isSameUser(
    rowUserId: Types.ObjectId | string | undefined,
    expectedUserId: Types.ObjectId,
  ): boolean {
    if (!rowUserId) {
      return false;
    }

    return rowUserId.toString() === expectedUserId.toString();
  }
}
