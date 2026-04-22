import { Injectable } from '@nestjs/common';
import { RetrievedChunk } from '../interfaces/retrieved-chunk.interface';

const DEFAULT_MAX_CONTEXT_CHARS = 12_000;
const MIN_CONTEXT_CHARS = 1_000;

export interface RagContextBuildResult {
  context: string;
  contextChunkCount: number;
  contextCharCount: number;
  contextTrimmed: boolean;
}

@Injectable()
export class RagContextBuilder {
  build(chunks: RetrievedChunk[]): RagContextBuildResult {
    if (chunks.length === 0) {
      const context = '（无可用检索片段）';
      return {
        context,
        contextChunkCount: 0,
        contextCharCount: context.length,
        contextTrimmed: false,
      };
    }

    const maxChars = this.resolveMaxContextChars();
    const contextParts: string[] = [];
    let contextCharCount = 0;
    let contextTrimmed = false;

    for (const chunk of chunks) {
      const nextPart = this.formatChunk(chunk, contextParts.length + 1);
      const separatorLength = contextParts.length === 0 ? 0 : 2;
      const nextLength = separatorLength + nextPart.length;

      if (contextCharCount + nextLength <= maxChars) {
        contextParts.push(nextPart);
        contextCharCount += nextLength;
        continue;
      }

      const remainingChars = maxChars - contextCharCount - separatorLength;
      if (remainingChars > 0) {
        contextParts.push(this.trimPart(nextPart, remainingChars));
        contextCharCount = maxChars;
      }

      contextTrimmed = true;
      break;
    }

    if (contextParts.length < chunks.length) {
      contextTrimmed = true;
    }

    const context = contextParts.join('\n\n');
    return {
      context,
      contextChunkCount: contextParts.length,
      contextCharCount: context.length,
      contextTrimmed,
    };
  }

  private formatChunk(chunk: RetrievedChunk, index: number): string {
    const page =
      chunk.metadata.page === undefined ? 'unknown' : `${chunk.metadata.page}`;
    const docName =
      chunk.metadata.originalName ?? chunk.metadata.source ?? 'unknown';
    const order =
      chunk.chunkIndex === undefined ? 'unknown' : `${chunk.chunkIndex}`;
    return [
      `[${index}] documentId=${chunk.documentId}`,
      `chunkId=${chunk.chunkId}`,
      `documentName=${docName}`,
      `page=${page}`,
      `order=${order}`,
      `score=${chunk.score.toFixed(6)}`,
      `content=${chunk.content}`,
    ].join('\n');
  }

  private trimPart(part: string, maxChars: number): string {
    if (part.length <= maxChars) {
      return part;
    }

    const suffix = '\n...[context trimmed]';
    if (maxChars <= suffix.length) {
      return part.slice(0, maxChars);
    }

    return `${part.slice(0, maxChars - suffix.length)}${suffix}`;
  }

  private resolveMaxContextChars(): number {
    const parsed = Number.parseInt(process.env.RAG_CONTEXT_MAX_CHARS ?? '', 10);
    if (Number.isInteger(parsed) && parsed >= MIN_CONTEXT_CHARS) {
      return parsed;
    }

    return DEFAULT_MAX_CONTEXT_CHARS;
  }
}
