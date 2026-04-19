import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Document as LangChainDocument } from '@langchain/core/documents';
import { Model, Types } from 'mongoose';
import {
  Document,
  DocumentDocument,
} from '../../documents/schemas/document.schema';
import { RetrievedChunk } from '../../rag/interfaces/retrieved-chunk.interface';
import { ChunkMetadataBuilder } from '../builders/chunk-metadata.builder';
import { IngestionEmbeddingsFactory } from '../embeddings/embeddings.factory';
import { ChunkMetadata } from '../interfaces/chunk-metadata.interface';
import { DocumentLoaderFactory } from '../loaders/document-loader.factory';
import { LangchainDocumentMapper } from '../mappers/langchain-document.mapper';
import {
  ChunkStrategyTestChunk,
  ChunkStrategyTestChunkDocument,
} from './chunk-strategy-test-chunk.schema';
import { NormalizedChunkStrategyConfig } from './chunk-strategy.types';
import { TextSplitterFactory } from '../splitters/text-splitter.factory';

interface TestChunkCandidateDocument {
  _id: Types.ObjectId;
  documentId: Types.ObjectId;
  chunkIndex: number;
  embedding: number[];
  content: string;
  metadata: ChunkMetadata;
}

@Injectable()
export class ChunkStrategyRunner {
  constructor(
    @InjectModel(Document.name)
    private readonly documentModel: Model<DocumentDocument>,
    @InjectModel(ChunkStrategyTestChunk.name)
    private readonly testChunkModel: Model<ChunkStrategyTestChunkDocument>,
    private readonly documentLoaderFactory: DocumentLoaderFactory,
    private readonly textSplitterFactory: TextSplitterFactory,
    private readonly embeddingsFactory: IngestionEmbeddingsFactory,
    private readonly langchainDocumentMapper: LangchainDocumentMapper,
    private readonly chunkMetadataBuilder: ChunkMetadataBuilder,
  ) {}

  async ingestByStrategy(input: {
    userId: string;
    testRunId: string;
    documentIds: string[];
    strategy: NormalizedChunkStrategyConfig;
  }): Promise<{ chunkCount: number; avgLength: number }> {
    const normalizedUserId = this.toObjectId(input.userId);
    const normalizedDocumentIds = this.normalizeObjectIds(input.documentIds);
    const documents = await this.loadOwnedDocuments(
      normalizedUserId,
      normalizedDocumentIds,
    );

    await this.testChunkModel
      .deleteMany({
        userId: normalizedUserId,
        testRunId: input.testRunId,
        strategyName: input.strategy.name,
      })
      .exec();

    const splitter = this.textSplitterFactory.createSplitterByConfig({
      chunkSize: input.strategy.chunkSize,
      chunkOverlap: input.strategy.chunkOverlap,
      splitterType: input.strategy.splitterType,
    });
    const embeddings = this.embeddingsFactory.createEmbeddings();
    const payload: Array<Partial<ChunkStrategyTestChunk>> = [];
    let totalLength = 0;

    for (const document of documents) {
      const loadedDocuments = await this.documentLoaderFactory.load({
        storagePath: document.storagePath,
        originalName: document.originalName,
        mimeType: document.mimeType,
      });

      if (loadedDocuments.length === 0) {
        continue;
      }

      const mappedDocuments = this.langchainDocumentMapper.mapLoadedDocuments({
        loadedDocuments,
        userId: input.userId,
        documentId: document.id,
        originalName: document.originalName,
        mimeType: document.mimeType,
      });

      const chunkDocuments = await splitter.splitDocuments(mappedDocuments);
      if (chunkDocuments.length === 0) {
        continue;
      }

      const chunksForEmbedding = chunkDocuments.map(
        (
          chunkDocument: LangChainDocument,
          chunkIndex: number,
        ): LangChainDocument =>
          new LangChainDocument({
            pageContent: chunkDocument.pageContent,
            metadata: this.chunkMetadataBuilder.build({
              metadata: chunkDocument.metadata,
              originalName: document.originalName,
              mimeType: document.mimeType,
              documentId: document.id,
              userId: input.userId,
            }),
            id: `${input.testRunId}-${input.strategy.name}-${document.id}-${chunkIndex}`,
          }),
      );

      const vectors = await embeddings.embedDocuments(
        chunksForEmbedding.map((item): string => item.pageContent),
      );

      if (vectors.length !== chunksForEmbedding.length) {
        throw new BadRequestException('Embedding result size mismatch');
      }

      chunksForEmbedding.forEach((item, index): void => {
        totalLength += item.pageContent.length;
        payload.push({
          userId: normalizedUserId,
          documentId: this.toObjectId(document.id),
          testRunId: input.testRunId,
          strategyName: input.strategy.name,
          chunkIndex: index,
          content: item.pageContent,
          embedding: vectors[index],
          metadata: item.metadata,
        });
      });
    }

    if (payload.length > 0) {
      await this.testChunkModel.insertMany(payload, { ordered: true });
    }

    const avgLength = payload.length === 0 ? 0 : totalLength / payload.length;
    return {
      chunkCount: payload.length,
      avgLength: Number(avgLength.toFixed(2)),
    };
  }

  async retrieveByStrategy(input: {
    userId: string;
    testRunId: string;
    strategyName: string;
    queryEmbedding: number[];
    topK: number;
    documentIds: string[];
  }): Promise<RetrievedChunk[]> {
    const normalizedUserId = this.toObjectId(input.userId);
    const normalizedDocumentIds = this.normalizeObjectIds(input.documentIds);

    const rows = await this.testChunkModel
      .find({
        userId: normalizedUserId,
        testRunId: input.testRunId,
        strategyName: input.strategyName,
        documentId: { $in: normalizedDocumentIds },
      })
      .select({ _id: 1, documentId: 1, chunkIndex: 1, embedding: 1, content: 1, metadata: 1 })
      .lean<TestChunkCandidateDocument[]>()
      .exec();

    if (rows.length === 0) {
      return [];
    }

    return rows
      .map(
        (row): RetrievedChunk | null => {
          const score = this.cosineSimilarity(input.queryEmbedding, row.embedding);
          if (!Number.isFinite(score)) {
            return null;
          }
          return {
            chunkId: row._id.toString(),
            documentId: row.documentId.toString(),
            chunkIndex: row.chunkIndex,
            content: row.content,
            score,
            metadata: row.metadata,
          };
        },
      )
      .filter((item): item is RetrievedChunk => item !== null)
      .sort((left, right): number => right.score - left.score)
      .slice(0, input.topK);
  }

  private async loadOwnedDocuments(
    userId: Types.ObjectId,
    documentIds: Types.ObjectId[],
  ): Promise<DocumentDocument[]> {
    const rows = await this.documentModel
      .find({
        _id: { $in: documentIds },
        userId,
      })
      .exec();

    if (rows.length !== documentIds.length) {
      throw new NotFoundException('Some documents do not exist or are not owned by user');
    }

    return rows;
  }

  private normalizeObjectIds(values: string[]): Types.ObjectId[] {
    const unique = new Set<string>();
    values.forEach((value): void => {
      const normalized = value.trim();
      if (normalized.length > 0) {
        unique.add(normalized);
      }
    });
    return Array.from(unique, (value): Types.ObjectId => this.toObjectId(value));
  }

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }
    return new Types.ObjectId(value);
  }

  private cosineSimilarity(left: number[], right: number[]): number {
    if (left.length === 0 || right.length === 0 || left.length !== right.length) {
      return Number.NaN;
    }

    let dotProduct = 0;
    let leftNorm = 0;
    let rightNorm = 0;

    for (let i = 0; i < left.length; i += 1) {
      const leftValue = left[i];
      const rightValue = right[i];
      dotProduct += leftValue * rightValue;
      leftNorm += leftValue * leftValue;
      rightNorm += rightValue * rightValue;
    }

    if (leftNorm === 0 || rightNorm === 0) {
      return Number.NaN;
    }

    return dotProduct / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
  }
}
