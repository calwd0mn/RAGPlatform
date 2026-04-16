import { Injectable } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_CHUNK_OVERLAP = 150;

@Injectable()
export class TextSplitterFactory {
  createSplitter(): RecursiveCharacterTextSplitter {
    return new RecursiveCharacterTextSplitter({
      chunkSize: this.readPositiveInteger(
        process.env.INGESTION_CHUNK_SIZE,
        DEFAULT_CHUNK_SIZE,
      ),
      chunkOverlap: this.readNonNegativeInteger(
        process.env.INGESTION_CHUNK_OVERLAP,
        DEFAULT_CHUNK_OVERLAP,
      ),
    });
  }

  private readPositiveInteger(input: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(input ?? '', 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
    return fallback;
  }

  private readNonNegativeInteger(input: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(input ?? '', 10);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
    return fallback;
  }
}

