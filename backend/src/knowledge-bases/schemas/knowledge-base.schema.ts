import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ChunkSplitterType } from '../../ingestion/splitters/chunk-splitter.type';

export type KnowledgeBaseDocument = HydratedDocument<KnowledgeBase>;

@Schema({ timestamps: true })
export class KnowledgeBase {
  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ type: Boolean, required: true, default: false })
  isDefault!: boolean;

  @Prop({ type: String, required: false, trim: true, maxlength: 120 })
  activeChunkStrategyName?: string;

  @Prop({ type: String, required: false, trim: true, maxlength: 120 })
  activeChunkStrategyVersion?: string;

  @Prop({ type: Number, required: false, min: 50, max: 8000 })
  activeChunkSize?: number;

  @Prop({ type: Number, required: false, min: 0, max: 4000 })
  activeChunkOverlap?: number;

  @Prop({
    type: String,
    required: false,
    enum: ['recursive', 'markdown', 'token'],
  })
  activeChunkSplitterType?: ChunkSplitterType;

  @Prop({ type: Boolean, required: false, default: false })
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
