import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ChunkSplitterType } from '../../ingestion/chunk-strategy/chunk-strategy.types';

export type KnowledgeBaseDocument = HydratedDocument<KnowledgeBase>;

@Schema({ timestamps: true })
export class KnowledgeBase {
  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ required: true, default: false })
  isDefault!: boolean;

  @Prop({ required: false, trim: true, maxlength: 120 })
  activeChunkStrategyName?: string;

  @Prop({ required: false, trim: true, maxlength: 120 })
  activeChunkStrategyVersion?: string;

  @Prop({ required: false, min: 50, max: 8000 })
  activeChunkSize?: number;

  @Prop({ required: false, min: 0, max: 4000 })
  activeChunkOverlap?: number;

  @Prop({ required: false, enum: ['recursive', 'markdown', 'token'] })
  activeChunkSplitterType?: ChunkSplitterType;

  @Prop({ required: false, default: false })
  activeChunkPreserveSentenceBoundary?: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const KnowledgeBaseSchema = SchemaFactory.createForClass(KnowledgeBase);

KnowledgeBaseSchema.index({ userId: 1, name: 1 }, { unique: true });
KnowledgeBaseSchema.index(
  { userId: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } },
);
