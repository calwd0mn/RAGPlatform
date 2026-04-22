import { Injectable } from '@nestjs/common';
import { ChunkMetadata } from '../interfaces/chunk-metadata.interface';

interface BuildChunkMetadataInput {
  metadata: ChunkMetadata;
  originalName: string;
  mimeType: string;
  documentId: string;
  userId: string;
  startOffset?: number;
  endOffset?: number;
}

// 构建Chunk metadata
@Injectable()
export class ChunkMetadataBuilder {
  build(input: BuildChunkMetadataInput): ChunkMetadata {
    const page = this.asNumber(input.metadata.page);
    const source = this.asNonEmptyString(input.metadata.source);

    return {
      page,
      source,
      startOffset: input.startOffset,
      endOffset: input.endOffset,
      originalName: input.originalName,
      mimeType: input.mimeType,
      documentId: input.documentId,
      userId: input.userId,
    };
  }

  private asNumber(value: number | undefined): number | undefined {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return undefined;
    }
    return value;
  }

  private asNonEmptyString(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }
}
