import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Document as LangChainDocument } from '@langchain/core/documents';
import { MongoDBAtlasVectorSearch } from '@langchain/mongodb';
import { Collection, Document as MongoDocument } from 'mongodb';
import { Model, Types } from 'mongoose';
import { RetrievedChunk } from '../../rag/interfaces/retrieved-chunk.interface';
import { getRagRetrievalConfig } from '../../rag/retrievers/config/rag-retrieval.config';
import { ChunkMetadata } from '../interfaces/chunk-metadata.interface';
import { Chunk, ChunkDocument } from '../schemas/chunk.schema';
import { IngestionEmbeddingsFactory } from '../embeddings/embeddings.factory';

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
export class ChunkVectorStoreService {
  constructor(
    @InjectModel(Chunk.name)
    private readonly chunkModel: Model<ChunkDocument>,
    private readonly embeddingsFactory: IngestionEmbeddingsFactory,
  ) {}

  async replaceDocumentChunks(input: {
    userId: Types.ObjectId;
    knowledgeBaseId: Types.ObjectId;
    documentId: Types.ObjectId;
    chunks: LangChainDocument<ChunkMetadata>[];
  }): Promise<number> {
    await this.chunkModel
      .deleteMany({
        userId: input.userId,
        documentId: input.documentId,
      })
      .exec();

    const documents = input.chunks.map(
      (
        chunkDocument: LangChainDocument<ChunkMetadata>,
        chunkIndex: number,
      ): LangChainDocument<ChunkVectorDocumentMetadata> =>
        new LangChainDocument<ChunkVectorDocumentMetadata>({
          pageContent: chunkDocument.pageContent,
          metadata: {
            userId: input.userId,
            knowledgeBaseId: input.knowledgeBaseId,
            documentId: input.documentId,
            chunkIndex,
            metadata: chunkDocument.metadata,
          },
        }),
    );

    await this.createAtlasVectorStore().addDocuments(documents);
    return documents.length;
  }

  async similaritySearchByVector(input: {
    userId: Types.ObjectId;
    knowledgeBaseId: Types.ObjectId;
    queryEmbedding: number[];
    topK: number;
  }): Promise<RetrievedChunk[]> {
    if (input.queryEmbedding.length === 0) {
      throw new InternalServerErrorException('Query embedding is empty');
    }

    const rows =
      await this.createAtlasVectorStore().similaritySearchVectorWithScore(
        input.queryEmbedding,
        input.topK,
        {
          preFilter: {
            userId: input.userId,
            knowledgeBaseId: input.knowledgeBaseId,
          },
        },
      );

    return rows
      .map(([document, score]): RetrievedChunk | null =>
        this.mapSearchResult(
          document,
          score,
          input.userId,
          input.knowledgeBaseId,
        ),
      )
      .filter((chunk): chunk is RetrievedChunk => chunk !== null);
  }

  private createAtlasVectorStore(): MongoDBAtlasVectorSearch {
    const config = getRagRetrievalConfig();
    const collection = this.chunkModel.collection as Collection<MongoDocument>;
    return new MongoDBAtlasVectorSearch(
      this.embeddingsFactory.createEmbeddings(),
      {
        collection,
        indexName: config.vectorIndexName,
        textKey: 'content',
        embeddingKey: config.vectorPath,
      },
    );
  }

  private mapSearchResult(
    document: LangChainDocument,
    score: number,
    userId: Types.ObjectId,
    knowledgeBaseId: Types.ObjectId,
  ): RetrievedChunk | null {
    const metadata = document.metadata as ChunkVectorSearchMetadata;
    const chunkId = this.toIdString(metadata._id);
    const documentId = this.toIdString(metadata.documentId);
    const rowUserId = this.toIdString(metadata.userId);
    const rowKnowledgeBaseId = this.toIdString(metadata.knowledgeBaseId);

    if (
      !chunkId ||
      !documentId ||
      rowUserId !== userId.toString() ||
      rowKnowledgeBaseId !== knowledgeBaseId.toString()
    ) {
      return null;
    }

    return {
      chunkId,
      documentId,
      chunkIndex: metadata.chunkIndex,
      content: document.pageContent,
      score,
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
