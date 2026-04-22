import { Injectable } from '@nestjs/common';
import {
  MarkdownTextSplitter,
  RecursiveCharacterTextSplitter,
  TextSplitter,
  TokenTextSplitter,
} from '@langchain/textsplitters';
import { ChunkSplitterType } from './chunk-splitter.type';

const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_CHUNK_OVERLAP = 150;
const DEFAULT_SPLITTER_TYPE: ChunkSplitterType = 'recursive';

interface TextSplitterConfig {
  chunkSize: number;
  chunkOverlap: number;
  splitterType: ChunkSplitterType;
  preserveSentenceBoundary: boolean;
  separators: string[];
}

const SENTENCE_BOUNDARY_SEPARATORS = [
  '\n\n',
  '\n',
  '。 ',
  '。\n',
  '！ ',
  '！\n',
  '？ ',
  '？\n',
  '； ',
  '；\n',
  '. ',
  '! ',
  '? ',
  '; ',
  '。',
  '！',
  '？',
  '；',
  '.',
  '!',
  '?',
  ';',
  '，',
  '、',
  ',',
  ' ',
  '',
] as const;

@Injectable()
export class TextSplitterFactory {
  createSplitter(): TextSplitter {
    return this.createConfiguredSplitter({
      chunkSize: this.readPositiveInteger(
        process.env.INGESTION_CHUNK_SIZE,
        DEFAULT_CHUNK_SIZE,
      ),
      chunkOverlap: this.readNonNegativeInteger(
        process.env.INGESTION_CHUNK_OVERLAP,
        DEFAULT_CHUNK_OVERLAP,
      ),
      splitterType: this.readSplitterType(
        process.env.INGESTION_SPLITTER_TYPE,
        DEFAULT_SPLITTER_TYPE,
      ),
      preserveSentenceBoundary: false,
      separators: [],
    });
  }

  createSplitterByConfig(input: {
    chunkSize: number;
    chunkOverlap: number;
    splitterType?: ChunkSplitterType;
    preserveSentenceBoundary?: boolean;
    separators?: string[];
  }): TextSplitter {
    const splitterType = input.splitterType ?? DEFAULT_SPLITTER_TYPE;
    return this.createConfiguredSplitter({
      chunkSize: this.readPositiveInteger(
        input.chunkSize.toString(),
        DEFAULT_CHUNK_SIZE,
      ),
      chunkOverlap: this.readNonNegativeInteger(
        input.chunkOverlap.toString(),
        DEFAULT_CHUNK_OVERLAP,
      ),
      splitterType,
      preserveSentenceBoundary: input.preserveSentenceBoundary ?? false,
      separators: input.separators ?? [],
    });
  }

  private createConfiguredSplitter(config: TextSplitterConfig): TextSplitter {
    if (config.splitterType === 'markdown') {
      return new MarkdownTextSplitter({
        chunkSize: config.chunkSize,
        chunkOverlap: config.chunkOverlap,
      });
    }

    if (config.splitterType === 'token') {
      return new TokenTextSplitter({
        chunkSize: config.chunkSize,
        chunkOverlap: config.chunkOverlap,
      });
    }

    return new RecursiveCharacterTextSplitter({
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
      separators: this.resolveSeparators(config),
    });
  }

  private resolveSeparators(config: TextSplitterConfig): string[] | undefined {
    if (!config.preserveSentenceBoundary) {
      return undefined;
    }

    if (config.separators.length > 0) {
      return config.separators;
    }

    return Array.from(SENTENCE_BOUNDARY_SEPARATORS);
  }

  private readPositiveInteger(
    input: string | undefined,
    fallback: number,
  ): number {
    const parsed = Number.parseInt(input ?? '', 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
    return fallback;
  }

  private readNonNegativeInteger(
    input: string | undefined,
    fallback: number,
  ): number {
    const parsed = Number.parseInt(input ?? '', 10);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
    return fallback;
  }

  private readSplitterType(
    input: string | undefined,
    fallback: ChunkSplitterType,
  ): ChunkSplitterType {
    const normalized = (input ?? '').trim().toLowerCase();
    if (
      normalized === 'recursive' ||
      normalized === 'markdown' ||
      normalized === 'token'
    ) {
      return normalized;
    }
    return fallback;
  }
}
