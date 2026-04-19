import { RetrievedChunk } from '../../interfaces/retrieved-chunk.interface';
import { RagRunRetrievalHit } from '../../../schemas/rag-run.schema';

const PREVIEW_LIMIT = 240;

function toContentPreview(content: string): string {
  const compacted = content.replace(/\s+/g, ' ').trim();
  if (compacted.length <= PREVIEW_LIMIT) {
    return compacted;
  }
  return `${compacted.slice(0, PREVIEW_LIMIT)}...`;
}

export function mapRetrievedChunksToRunHits(
  chunks: RetrievedChunk[],
): RagRunRetrievalHit[] {
  return chunks.map(
    (chunk): RagRunRetrievalHit => ({
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      documentName:
        chunk.metadata.originalName ?? chunk.metadata.source ?? 'unknown',
      page: chunk.metadata.page,
      order: chunk.chunkIndex,
      score: chunk.score,
      contentPreview: toContentPreview(chunk.content),
    }),
  );
}
