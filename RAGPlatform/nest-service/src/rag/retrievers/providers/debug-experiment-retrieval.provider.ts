import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChunkMetadata } from '../../../ingestion/interfaces/chunk-metadata.interface';
import {
  DebugExperimentChunk,
  DebugExperimentChunkDocument,
} from '../../../schemas/debug-experiment-chunk.schema';
import { RetrievedChunk } from '../../interfaces/retrieved-chunk.interface';
import { cosineSimilarity } from '../utils/cosine-similarity.util';

interface ExperimentChunkCandidateDocument {
  _id: Types.ObjectId;
  documentId: Types.ObjectId;
  chunkIndex: number;
  embedding: number[];
  metadata: ChunkMetadata;
}

interface ExperimentChunkContentDocument {
  _id: Types.ObjectId;
  content: string;
}

@Injectable()
export class DebugExperimentRetrievalProvider {
  constructor(
    @InjectModel(DebugExperimentChunk.name)
    private readonly experimentChunkModel: Model<DebugExperimentChunkDocument>,
  ) {}

  async retrieveTopKByExperiment(input: {
    userId: string;
    knowledgeBaseId: string;
    experimentId: string;
    strategyName: string;
    queryEmbedding: number[];
    topK: number;
  }): Promise<RetrievedChunk[]> {
    const normalizedUserId = this.toObjectId(input.userId);
    const normalizedExperimentId = this.toObjectId(input.experimentId);

    const candidates = await this.experimentChunkModel
      .find({
        userId: normalizedUserId,
        knowledgeBaseId: this.toObjectId(input.knowledgeBaseId),
        experimentId: normalizedExperimentId,
        strategyName: input.strategyName,
      })
      .sort({ createdAt: -1 })
      .select({
        _id: 1,
        documentId: 1,
        chunkIndex: 1,
        embedding: 1,
        metadata: 1,
      })
      .lean<ExperimentChunkCandidateDocument[]>()
      .exec();

    if (candidates.length === 0) {
      return [];
    }

    const topCandidates = candidates
      .map(
        (candidate): {
        chunkId: string;
        documentId: string;
        chunkIndex: number;
        score: number;
        metadata: ChunkMetadata;
      } => {
        return {
          chunkId: candidate._id.toString(),
          documentId: candidate.documentId.toString(),
          chunkIndex: candidate.chunkIndex,
          score: cosineSimilarity(input.queryEmbedding, candidate.embedding),
          metadata: candidate.metadata,
        };
      },
      )
      .sort((left, right): number => right.score - left.score)
      .slice(0, input.topK);

    if (topCandidates.length === 0) {
      return [];
    }

    const targetIds = topCandidates.map(
      (candidate): Types.ObjectId => new Types.ObjectId(candidate.chunkId),
    );
    const contentRows = await this.experimentChunkModel
      .find({
        _id: { $in: targetIds },
        userId: normalizedUserId,
        knowledgeBaseId: this.toObjectId(input.knowledgeBaseId),
        experimentId: normalizedExperimentId,
        strategyName: input.strategyName,
      })
      .select({ _id: 1, content: 1 })
      .lean<ExperimentChunkContentDocument[]>()
      .exec();

    const contentMap = new Map<string, string>(
      contentRows.map((row): [string, string] => [
        row._id.toString(),
        row.content,
      ]),
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

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }

    return new Types.ObjectId(value);
  }
}
