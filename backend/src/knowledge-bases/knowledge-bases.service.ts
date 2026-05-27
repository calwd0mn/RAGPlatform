import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Conversation,
  ConversationDocument,
} from '../conversations/schemas/conversation.schema';
import {
  Document,
  DocumentDocument,
} from '../documents/schemas/document.schema';
import { Chunk, ChunkDocument } from '../ingestion/schemas/chunk.schema';
import { ChunkSplitterType } from '../ingestion/splitters/chunk-splitter.type';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { KnowledgeBaseResponse } from './interfaces/knowledge-base-response.interface';
import {
  KnowledgeBase,
  KnowledgeBaseDocument,
} from './schemas/knowledge-base.schema';

const DEFAULT_KNOWLEDGE_BASE_NAME = '默认知识库';

@Injectable()
export class KnowledgeBasesService {
  constructor(
    @InjectModel(KnowledgeBase.name)
    private readonly knowledgeBaseModel: Model<KnowledgeBaseDocument>,
    @InjectModel(Document.name)
    private readonly documentModel: Model<DocumentDocument>,
    @InjectModel(Chunk.name)
    private readonly chunkModel: Model<ChunkDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
  ) {}

  async findAllByUser(userId: string): Promise<KnowledgeBaseResponse[]> {
    const normalizedUserId = this.toObjectId(userId);
    await this.ensureDefaultKnowledgeBase(userId);
    const rows = await this.knowledgeBaseModel
      .find({ userId: normalizedUserId })
      .sort({ isDefault: -1, createdAt: 1 })
      .exec();
    return rows.map((row): KnowledgeBaseResponse => this.toResponse(row));
  }

  async create(
    userId: string,
    dto: CreateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseResponse> {
    await this.ensureDefaultKnowledgeBase(userId);
    const normalizedUserId = this.toObjectId(userId);
    const name = dto.name.trim();

    const existing = await this.knowledgeBaseModel
      .findOne({ userId: normalizedUserId, name })
      .exec();
    if (existing) {
      throw new ConflictException('Knowledge base name already exists');
    }

    const row = new this.knowledgeBaseModel({
      userId: normalizedUserId,
      name,
      isDefault: false,
    });
    return this.toResponse(await row.save());
  }

  async update(
    userId: string,
    knowledgeBaseId: string,
    dto: UpdateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseResponse> {
    const normalizedUserId = this.toObjectId(userId);
    const normalizedKnowledgeBaseId = this.toObjectId(knowledgeBaseId);

    const updatePayload: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const existing = await this.knowledgeBaseModel
        .findOne({
          userId: normalizedUserId,
          name,
          _id: { $ne: normalizedKnowledgeBaseId },
        })
        .exec();
      if (existing) {
        throw new ConflictException('Knowledge base name already exists');
      }
      updatePayload.name = name;
    }

    if (dto.clearActiveChunkStrategy) {
      updatePayload.activeChunkStrategyName = undefined;
      updatePayload.activeChunkStrategyVersion = undefined;
      updatePayload.activeChunkSize = undefined;
      updatePayload.activeChunkOverlap = undefined;
      updatePayload.activeChunkSplitterType = undefined;
      updatePayload.activeChunkPreserveSentenceBoundary = undefined;
    } else if (dto.chunkStrategy) {
      const strategyName = dto.chunkStrategy.name?.trim() || 'kb-manual';
      const strategyVersion = dto.chunkStrategy.version?.trim() || 'v1';
      if (dto.chunkStrategy.chunkOverlap >= dto.chunkStrategy.chunkSize) {
        throw new BadRequestException(
          'chunkOverlap must be smaller than chunkSize',
        );
      }

      updatePayload.activeChunkStrategyName = strategyName;
      updatePayload.activeChunkStrategyVersion = strategyVersion;
      updatePayload.activeChunkSize = dto.chunkStrategy.chunkSize;
      updatePayload.activeChunkOverlap = dto.chunkStrategy.chunkOverlap;
      updatePayload.activeChunkSplitterType =
        dto.chunkStrategy.splitterType ?? 'recursive';
      updatePayload.activeChunkPreserveSentenceBoundary =
        dto.chunkStrategy.preserveSentenceBoundary ?? false;
    }

    if (Object.keys(updatePayload).length === 0) {
      const existingKnowledgeBase = await this.knowledgeBaseModel
        .findOne({ _id: normalizedKnowledgeBaseId, userId: normalizedUserId })
        .exec();
      if (!existingKnowledgeBase) {
        throw new NotFoundException('Knowledge base not found');
      }
      return this.toResponse(existingKnowledgeBase);
    }

    const updated = await this.knowledgeBaseModel
      .findOneAndUpdate(
        { _id: normalizedKnowledgeBaseId, userId: normalizedUserId },
        updatePayload,
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Knowledge base not found');
    }

    return this.toResponse(updated);
  }

  async remove(userId: string, knowledgeBaseId: string): Promise<void> {
    const row = await this.findOwnedKnowledgeBaseDocument(
      userId,
      knowledgeBaseId,
    );
    if (row.isDefault) {
      throw new BadRequestException('Default knowledge base cannot be deleted');
    }

    const userObjectId = this.toObjectId(userId);
    const [documentCount, chunkCount, conversationCount] = await Promise.all([
      this.documentModel.countDocuments({
        userId: userObjectId,
        knowledgeBaseId: row._id,
      }),
      this.chunkModel.countDocuments({
        userId: userObjectId,
        knowledgeBaseId: row._id,
      }),
      this.conversationModel.countDocuments({
        userId: userObjectId,
        knowledgeBaseId: row._id,
      }),
    ]);

    if (documentCount > 0 || chunkCount > 0 || conversationCount > 0) {
      throw new BadRequestException(
        [
          'Knowledge base is not empty',
          `documents=${documentCount}`,
          `chunks=${chunkCount}`,
          `conversations=${conversationCount}`,
        ].join('; '),
      );
    }

    await this.knowledgeBaseModel.deleteOne({ _id: row._id }).exec();
  }

  async findOneByUser(
    userId: string,
    knowledgeBaseId: string,
  ): Promise<KnowledgeBaseResponse> {
    const row = await this.findOwnedKnowledgeBaseDocument(
      userId,
      knowledgeBaseId,
    );
    return this.toResponse(row);
  }

  async ensureDefaultKnowledgeBase(
    userId: string,
  ): Promise<KnowledgeBaseDocument> {
    const normalizedUserId = this.toObjectId(userId);
    const existing = await this.knowledgeBaseModel
      .findOne({ userId: normalizedUserId, isDefault: true })
      .exec();
    if (existing) {
      await this.backfillUserData(normalizedUserId, existing._id);
      return existing;
    }

    const created = await this.knowledgeBaseModel.create({
      userId: normalizedUserId,
      name: DEFAULT_KNOWLEDGE_BASE_NAME,
      isDefault: true,
    });
    await this.backfillUserData(normalizedUserId, created._id);
    return created;
  }

  async assertOwnedKnowledgeBase(
    userId: string,
    knowledgeBaseId: string,
  ): Promise<void> {
    await this.findOwnedKnowledgeBaseDocument(userId, knowledgeBaseId);
  }

  async updateActiveStrategy(input: {
    userId: string;
    knowledgeBaseId: string;
    strategyName: string;
    strategyVersion?: string;
    chunkSize?: number;
    chunkOverlap?: number;
    splitterType?: ChunkSplitterType;
    preserveSentenceBoundary?: boolean;
  }): Promise<void> {
    await this.knowledgeBaseModel
      .updateOne(
        {
          _id: this.toObjectId(input.knowledgeBaseId),
          userId: this.toObjectId(input.userId),
        },
        {
          activeChunkStrategyName: input.strategyName,
          activeChunkStrategyVersion: input.strategyVersion,
          activeChunkSize: input.chunkSize,
          activeChunkOverlap: input.chunkOverlap,
          activeChunkSplitterType: input.splitterType,
          activeChunkPreserveSentenceBoundary: input.preserveSentenceBoundary,
        },
      )
      .exec();
  }

  private async backfillUserData(
    userId: Types.ObjectId,
    knowledgeBaseId: Types.ObjectId,
  ): Promise<void> {
    await Promise.all([
      this.documentModel
        .updateMany(
          { userId, knowledgeBaseId: { $exists: false } },
          { knowledgeBaseId },
        )
        .exec(),
      this.chunkModel
        .updateMany(
          { userId, knowledgeBaseId: { $exists: false } },
          { knowledgeBaseId },
        )
        .exec(),
      this.conversationModel
        .updateMany(
          { userId, knowledgeBaseId: { $exists: false } },
          { knowledgeBaseId },
        )
        .exec(),
    ]).catch(() => {
      throw new InternalServerErrorException(
        'Failed to backfill knowledge base data',
      );
    });
  }

  private async findOwnedKnowledgeBaseDocument(
    userId: string,
    knowledgeBaseId: string,
  ): Promise<KnowledgeBaseDocument> {
    const row = await this.knowledgeBaseModel
      .findOne({
        _id: this.toObjectId(knowledgeBaseId),
        userId: this.toObjectId(userId),
      })
      .exec();
    if (!row) {
      throw new NotFoundException('Knowledge base not found');
    }
    return row;
  }

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }
    return new Types.ObjectId(value);
  }

  private toResponse(row: KnowledgeBaseDocument): KnowledgeBaseResponse {
    return {
      id: row.id,
      userId: row.userId.toString(),
      name: row.name,
      isDefault: row.isDefault,
      activeChunkStrategyName: row.activeChunkStrategyName,
      activeChunkStrategyVersion: row.activeChunkStrategyVersion,
      activeChunkSize: row.activeChunkSize,
      activeChunkOverlap: row.activeChunkOverlap,
      activeChunkSplitterType: row.activeChunkSplitterType,
      activeChunkPreserveSentenceBoundary:
        row.activeChunkPreserveSentenceBoundary,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
