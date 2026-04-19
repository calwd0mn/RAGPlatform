import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChunkMetadata } from '../../../ingestion/interfaces/chunk-metadata.interface';
import { Chunk, ChunkDocument } from '../../../ingestion/schemas/chunk.schema';
import { RetrievedChunk } from '../../interfaces/retrieved-chunk.interface';
import { getRagRetrievalConfig } from '../config/rag-retrieval.config';
import { RagRetrievalProvider } from '../interfaces/rag-retrieval-provider.interface';

interface ChunkCandidateDocument {
  _id: Types.ObjectId;
  documentId: Types.ObjectId;
  chunkIndex: number;
  embedding: number[];
  metadata: ChunkMetadata;
}

interface ChunkContentDocument {
  _id: Types.ObjectId;
  content: string;
}

@Injectable()
export class LocalCosineRetrievalProvider implements RagRetrievalProvider {
  readonly name = 'local';

  constructor(
    @InjectModel(Chunk.name)
    private readonly chunkModel: Model<ChunkDocument>,
  ) {}

  async retrieveTopKByUser(
    userId: string,
    knowledgeBaseId: string,
    queryEmbedding: number[],
    topK: number,
  ): Promise<RetrievedChunk[]> {
    const normalizedUserId = this.toObjectId(userId);
    const normalizedKnowledgeBaseId = this.toObjectId(knowledgeBaseId);
    const candidateLimit = Math.max(
      topK,
      getRagRetrievalConfig().vectorCandidateLimit,
    );

    const candidates = await this.chunkModel
      .find({ userId: normalizedUserId, knowledgeBaseId: normalizedKnowledgeBaseId })
      .sort({ createdAt: -1 })
      .limit(candidateLimit)
      .select({ _id: 1, documentId: 1, chunkIndex: 1, embedding: 1, metadata: 1 })
      .lean<ChunkCandidateDocument[]>()
      .exec();

    if (candidates.length === 0) {
      return [];
    }

    const topCandidates = candidates
      .map(
        (
          candidate,
        ): {
          chunkId: string;
          documentId: string;
          chunkIndex: number;
          score: number;
          metadata: ChunkMetadata;
        } | null => {
          const score = this.cosineSimilarity(queryEmbedding, candidate.embedding);
          if (!Number.isFinite(score)) {
            return null;
          }

          return {
            chunkId: candidate._id.toString(),
            documentId: candidate.documentId.toString(),
            chunkIndex: candidate.chunkIndex,
            score,
            metadata: candidate.metadata,
          };
        },
      )
      .filter(
        (
          candidate,
        ): candidate is {
          chunkId: string;
          documentId: string;
          chunkIndex: number;
          score: number;
          metadata: ChunkMetadata;
        } => candidate !== null,
      )
      .sort((left, right): number => right.score - left.score)
      .slice(0, topK);

    if (topCandidates.length === 0) {
      return [];
    }

    const targetIds = topCandidates.map(
      (candidate): Types.ObjectId => new Types.ObjectId(candidate.chunkId),
    );
    const contentRows = await this.chunkModel
      .find({
        _id: { $in: targetIds },
        userId: normalizedUserId,
        knowledgeBaseId: normalizedKnowledgeBaseId,
      })
      .select({ _id: 1, content: 1 })
      .lean<ChunkContentDocument[]>()
      .exec();

    const contentMap = new Map<string, string>(
      contentRows.map((row): [string, string] => [row._id.toString(), row.content]),
    );

    return topCandidates
      .map((candidate): RetrievedChunk | null => {
        const content = contentMap.get(candidate.chunkId);
        if (!content) {
          return null;
        }

        return {
          chunkId: candidate.chunkId,
          documentId: candidate.documentId,
          chunkIndex: candidate.chunkIndex,
          content,
          score: candidate.score,
          metadata: candidate.metadata,
        };
      })
      .filter((chunk): chunk is RetrievedChunk => chunk !== null);
  }

  private cosineSimilarity(left: number[], right: number[]): number {
    if (left.length === 0 || right.length === 0 || left.length !== right.length) {
      return Number.NaN;
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
      return Number.NaN;
    }

    return dotProduct / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
  }

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }

    return new Types.ObjectId(value);
  }
}
