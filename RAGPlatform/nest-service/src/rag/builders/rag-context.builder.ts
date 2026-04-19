import { Injectable } from '@nestjs/common';
import { RetrievedChunk } from '../interfaces/retrieved-chunk.interface';

@Injectable()
export class RagContextBuilder {
  build(chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) {
      return '（无可用检索片段）';
    }

    return chunks
      .map((chunk, index): string => {
        const page =
          chunk.metadata.page === undefined ? 'unknown' : `${chunk.metadata.page}`;
        const docName = chunk.metadata.originalName ?? chunk.metadata.source ?? 'unknown';
        const order =
          chunk.chunkIndex === undefined ? 'unknown' : `${chunk.chunkIndex}`;
        return [
          `[${index + 1}] documentId=${chunk.documentId}`,
          `chunkId=${chunk.chunkId}`,
          `documentName=${docName}`,
          `page=${page}`,
          `order=${order}`,
          `score=${chunk.score.toFixed(6)}`,
          `content=${chunk.content}`,
        ].join('\n');
      })
      .join('\n\n');
  }
}
