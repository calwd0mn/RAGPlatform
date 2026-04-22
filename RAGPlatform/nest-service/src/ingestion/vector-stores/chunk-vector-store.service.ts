import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Document as LangChainDocument } from '@langchain/core/documents';
import { MongoDBAtlasVectorSearch } from '@langchain/mongodb';
import { Collection, Document as MongoDocument } from 'mongodb';
import { Model, Types } from 'mongoose';
import { RetrievedChunk } from '../../rag/interfaces/retrieved-chunk.interface';
import { getRagRetrievalConfig } from '../../rag/retrievers/config/rag-retrieval.config';
import { ChunkMetadata } from '../interfaces/chunk-metadata.interface';
import { ChunkVectorDocumentMapper } from '../mappers/chunk-vector-document.mapper';
import { Chunk, ChunkDocument } from '../schemas/chunk.schema';
import { IngestionEmbeddingsFactory } from '../embeddings/embeddings.factory';

@Injectable()
export class ChunkVectorStoreService {
  constructor(
    @InjectModel(Chunk.name)
    private readonly chunkModel: Model<ChunkDocument>,
    private readonly embeddingsFactory: IngestionEmbeddingsFactory,
    private readonly chunkVectorDocumentMapper: ChunkVectorDocumentMapper,
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
      ): LangChainDocument =>
        this.chunkVectorDocumentMapper.toVectorDocument({
          chunkDocument,
          chunkIndex,
          userId: input.userId,
          knowledgeBaseId: input.knowledgeBaseId,
          documentId: input.documentId,
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
        this.chunkVectorDocumentMapper.toRetrievedChunk({
          document,
          score,
          userId: input.userId,
          knowledgeBaseId: input.knowledgeBaseId,
        }),
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

}
