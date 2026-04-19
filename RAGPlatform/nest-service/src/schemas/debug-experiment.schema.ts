import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const DEBUG_EXPERIMENT_STATUSES = [
  'draft',
  'running',
  'completed',
  'failed',
  'published',
] as const;
export type DebugExperimentStatus = (typeof DEBUG_EXPERIMENT_STATUSES)[number];

export const DEBUG_EXPERIMENT_SCOPES = ['legacy', 'manual'] as const;
export type DebugExperimentScope = (typeof DEBUG_EXPERIMENT_SCOPES)[number];

export const CHUNK_STRATEGY_TYPES = ['recursive', 'markdown', 'token'] as const;
export type ChunkStrategyType = (typeof CHUNK_STRATEGY_TYPES)[number];

export type DebugExperimentDocument = HydratedDocument<DebugExperiment>;

@Schema({ _id: false })
export class PromptDraft {
  @Prop({ required: true, trim: true, maxlength: 100 })
  basePromptId!: string;

  @Prop({ required: true, trim: true })
  systemPrompt!: string;

  @Prop({ required: true, trim: true })
  contextTemplate!: string;

  @Prop({ required: false, trim: true, maxlength: 120 })
  versionLabel?: string;
}

@Schema({ _id: false })
export class ChunkStrategyDraft {
  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ required: true, enum: CHUNK_STRATEGY_TYPES })
  type!: ChunkStrategyType;

  @Prop({ required: true, min: 50, max: 8000 })
  chunkSize!: number;

  @Prop({ required: true, min: 0, max: 4000 })
  chunkOverlap!: number;

  @Prop({ required: true, default: false })
  preserveSentenceBoundary!: boolean;

  @Prop({ type: [String], default: [] })
  separators!: string[];

  @Prop({ required: false, min: 1, max: 100 })
  maxSentenceMerge?: number;

  @Prop({ required: false, trim: true, maxlength: 120 })
  versionLabel?: string;
}

@Schema({ timestamps: true })
export class DebugExperiment {
  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    required: true,
    index: true,
    ref: 'KnowledgeBase',
  })
  knowledgeBaseId!: Types.ObjectId;

  @Prop({ required: true, enum: DEBUG_EXPERIMENT_SCOPES, index: true })
  scope!: DebugExperimentScope;

  @Prop({ type: [Types.ObjectId], required: true, default: [] })
  documentIds!: Types.ObjectId[];

  @Prop({ type: [String], required: true, default: [] })
  queries!: string[];

  @Prop({ type: PromptDraft, required: true })
  promptDraft!: PromptDraft;

  @Prop({ type: [ChunkStrategyDraft], required: true, default: [] })
  chunkStrategyDrafts!: ChunkStrategyDraft[];

  @Prop({ required: true, min: 1, max: 20 })
  topK!: number;

  @Prop({ required: true, enum: ['retrieve-only', 'full-rag'] })
  mode!: 'retrieve-only' | 'full-rag';

  @Prop({ required: true, enum: DEBUG_EXPERIMENT_STATUSES, index: true })
  status!: DebugExperimentStatus;

  @Prop({ required: true, trim: true, maxlength: 120, index: true })
  chunkNamespace!: string;

  @Prop({ required: false, trim: true, maxlength: 1000 })
  lastError?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const DebugExperimentSchema =
  SchemaFactory.createForClass(DebugExperiment);

DebugExperimentSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete (ret as any)._id;
    delete (ret as any).__v;
    return ret;
  },
});

DebugExperimentSchema.index({ userId: 1, createdAt: -1 });
