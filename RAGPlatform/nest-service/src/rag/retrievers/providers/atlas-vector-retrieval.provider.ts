import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ChunkVectorStoreService } from '../../../ingestion/vector-stores/chunk-vector-store.service';
import { RetrievedChunk } from '../../interfaces/retrieved-chunk.interface';
import { RagRetrievalProvider } from '../interfaces/rag-retrieval-provider.interface';

@Injectable()
export class AtlasVectorRetrievalProvider implements RagRetrievalProvider {
  readonly name = 'atlas';

  constructor(private readonly chunkVectorStoreService: ChunkVectorStoreService) {}

  async retrieveTopKByUser(
    userId: string,
    knowledgeBaseId: string,
    queryEmbedding: number[],
    topK: number,
  ): Promise<RetrievedChunk[]> {
    const normalizedUserId = this.toObjectId(userId);
    const normalizedKnowledgeBaseId = this.toObjectId(knowledgeBaseId);

    return this.chunkVectorStoreService.similaritySearchByVector({
      userId: normalizedUserId,
      knowledgeBaseId: normalizedKnowledgeBaseId,
      queryEmbedding,
      topK,
    });
  }

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }

    return new Types.ObjectId(value);
  }
}
