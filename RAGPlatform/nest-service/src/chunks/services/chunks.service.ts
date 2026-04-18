import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chunk, ChunkDocument } from '../../ingestion/schemas/chunk.schema';
import { ChunkContextItem, ChunkContextResponse } from '../interfaces/chunk-context-response.interface';

const DEFAULT_CONTEXT_WINDOW = 1;

@Injectable()
export class ChunksService {
  constructor(
    @InjectModel(Chunk.name)
    private readonly chunkModel: Model<ChunkDocument>,
  ) {}

  async getChunkContext(input: {
    userId: string;
    chunkId: string;
    before?: number;
    after?: number;
  }): Promise<ChunkContextResponse> {
    const normalizedUserId = this.toObjectId(input.userId);
    const normalizedChunkId = this.toObjectId(input.chunkId);
    const before = input.before ?? DEFAULT_CONTEXT_WINDOW;
    const after = input.after ?? DEFAULT_CONTEXT_WINDOW;

    const current = await this.chunkModel
      .findOne({
        _id: normalizedChunkId,
        userId: normalizedUserId,
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

    const [previous, next] = await Promise.all([
      before > 0
        ? this.chunkModel
            .find({
              userId: normalizedUserId,
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
        : Promise.resolve([]),
      after > 0
        ? this.chunkModel
            .find({
              userId: normalizedUserId,
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
        : Promise.resolve([]),
    ]);

    return {
      current: this.toContextItem(current),
      previous: previous
        .reverse()
        .map((item): ChunkContextItem => this.toContextItem(item)),
      next: next.map((item): ChunkContextItem => this.toContextItem(item)),
    };
  }

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }
    return new Types.ObjectId(value);
  }

  private toContextItem(chunk: ChunkDocument): ChunkContextItem {
    return {
      chunkId: chunk.id,
      documentId: chunk.documentId.toString(),
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      page: chunk.metadata?.page,
    };
  }
}
