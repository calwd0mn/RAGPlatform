import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  ChunkStrategyDraft,
  PromptDraft,
} from './debug-experiment.schema';

export const RAG_RUN_TYPES = ['ask', 'debug-retrieve', 'debug-render'] as const;
export type RagRunType = (typeof RAG_RUN_TYPES)[number];

export const RAG_RUN_STATUSES = ['success', 'error'] as const;
export type RagRunStatus = (typeof RAG_RUN_STATUSES)[number];

export const RAG_RETRIEVAL_SOURCES = ['production', 'experiment'] as const;
export type RagRetrievalSource = (typeof RAG_RETRIEVAL_SOURCES)[number];

export interface RagRunRetrievalHit {
  chunkId: string;
  documentId: string;
  documentName: string;
  page?: number;
  order?: number;
  score?: number;
  contentPreview: string;
}

export type RagRunDocument = HydratedDocument<RagRun>;

@Schema({ _id: false })
export class RagRunRetrievalHitSchemaClass implements RagRunRetrievalHit {
  @Prop({ required: true, trim: true })
  chunkId!: string;

  @Prop({ required: true, trim: true })
  documentId!: string;

  @Prop({ required: true, trim: true })
  documentName!: string;

  @Prop()
  page?: number;

  @Prop()
  order?: number;

  @Prop()
  score?: number;

  @Prop({ required: true, trim: true })
  contentPreview!: string;
}

@Schema({ timestamps: true })
export class RagRun {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  knowledgeBaseId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: false, index: true })
  conversationId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: false, index: true })
  experimentId?: Types.ObjectId;

  @Prop({ required: true, enum: RAG_RUN_TYPES, index: true })
  runType!: RagRunType;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 2000 })
  query!: string;

  @Prop({ required: true, trim: true, maxlength: 100 })
  promptVersion!: string;

  @Prop({ required: false, min: 1 })
  topK?: number;

  @Prop({ required: false, trim: true, maxlength: 32 })
  retrievalProvider?: string;

  @Prop({ required: false, trim: true, maxlength: 120 })
  retrievalNamespace?: string;

  @Prop({ required: false, enum: RAG_RETRIEVAL_SOURCES })
  retrievalSource?: RagRetrievalSource;

  @Prop({ required: false, trim: true, maxlength: 200 })
  comparisonKey?: string;

  @Prop({ type: PromptDraft, required: false })
  promptSnapshot?: PromptDraft;

  @Prop({ type: ChunkStrategyDraft, required: false })
  chunkStrategySnapshot?: ChunkStrategyDraft;

  @Prop({ type: [RagRunRetrievalHitSchemaClass], default: [] })
  retrievalHits!: RagRunRetrievalHit[];

  @Prop({ required: true, min: 0 })
  latencyMs!: number;

  @Prop({ required: true, enum: RAG_RUN_STATUSES, index: true })
  status!: RagRunStatus;

  @Prop({ required: false, trim: true, maxlength: 100 })
  errorCode?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const RagRunSchema = SchemaFactory.createForClass(RagRun);

RagRunSchema.index({ userId: 1, createdAt: -1 });
RagRunSchema.index({ userId: 1, runType: 1, createdAt: -1 });
