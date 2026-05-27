import { Injectable } from '@nestjs/common';
import { RagCitation } from '../interfaces/rag-citation.interface';
import { RetrievedChunk } from '../interfaces/retrieved-chunk.interface';

@Injectable()
export class ChunkToCitationMapper {
  map(chunk: RetrievedChunk): RagCitation {
    return {
      documentId: chunk.documentId,
      chunkId: chunk.chunkId,
      documentName: chunk.metadata.originalName ?? chunk.metadata.source,
      content: chunk.content,
      score: chunk.score,
      page: chunk.metadata.page,
    };
  }
}
