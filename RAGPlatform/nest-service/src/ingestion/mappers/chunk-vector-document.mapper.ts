import { Injectable } from '@nestjs/common';
import { Document as LangChainDocument } from '@langchain/core/documents';
import { Types } from 'mongoose';
import { RetrievedChunk } from '../../rag/interfaces/retrieved-chunk.interface';
import { ChunkMetadata } from '../interfaces/chunk-metadata.interface';

type ChunkVectorDocumentMetadata = Record<
  string,
  Types.ObjectId | number | ChunkMetadata
> & {
  userId: Types.ObjectId;
  knowledgeBaseId: Types.ObjectId;
  documentId: Types.ObjectId;
  chunkIndex: number;
  metadata: ChunkMetadata;
};

type ChunkVectorSearchMetadata = Record<
  string,
  Types.ObjectId | string | number | ChunkMetadata | undefined
> & {
  _id?: Types.ObjectId | string;
  userId?: Types.ObjectId | string;
  knowledgeBaseId?: Types.ObjectId | string;
  documentId?: Types.ObjectId | string;
  chunkIndex?: number;
  metadata?: ChunkMetadata;
};

@Injectable()
export class ChunkVectorDocumentMapper {
  toVectorDocument(input: {
    chunkDocument: LangChainDocument<ChunkMetadata>;
    chunkIndex: number;
    userId: Types.ObjectId;
    knowledgeBaseId: Types.ObjectId;
    documentId: Types.ObjectId;
  }): LangChainDocument<ChunkVectorDocumentMetadata> {
    return new LangChainDocument<ChunkVectorDocumentMetadata>({
      pageContent: input.chunkDocument.pageContent,
      metadata: {
        userId: input.userId,
        knowledgeBaseId: input.knowledgeBaseId,
        documentId: input.documentId,
        chunkIndex: input.chunkIndex,
        metadata: input.chunkDocument.metadata,
      },
    });
  }

  toRetrievedChunk(input: {
    document: LangChainDocument;
    score: number;
    userId: Types.ObjectId;
    knowledgeBaseId: Types.ObjectId;
  }): RetrievedChunk | null {
    const metadata = input.document.metadata as ChunkVectorSearchMetadata;
    const chunkId = this.toIdString(metadata._id);
    const documentId = this.toIdString(metadata.documentId);
    const rowUserId = this.toIdString(metadata.userId);
    const rowKnowledgeBaseId = this.toIdString(metadata.knowledgeBaseId);

    if (
      !chunkId ||
      !documentId ||
      rowUserId !== input.userId.toString() ||
      rowKnowledgeBaseId !== input.knowledgeBaseId.toString()
    ) {
      return null;
    }

    return {
      chunkId,
      documentId,
      chunkIndex: metadata.chunkIndex,
      content: input.document.pageContent,
      score: input.score,
      metadata: metadata.metadata ?? {},
    };
  }

  private toIdString(
    value: Types.ObjectId | string | undefined,
  ): string | null {
    if (!value) {
      return null;
    }

    return value.toString();
  }
}
