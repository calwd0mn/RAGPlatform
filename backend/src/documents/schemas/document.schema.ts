import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  DOCUMENT_STATUSES,
  DocumentStatus,
} from '../interfaces/document-status.type';

export type DocumentDocument = HydratedDocument<Document>;

@Schema({ timestamps: true })
export class Document {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  knowledgeBaseId!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 255 })
  filename!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 255 })
  originalName!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 100 })
  mimeType!: string;

  @Prop({ type: Number, required: true, min: 1 })
  size!: number;

  @Prop({ type: String, required: true, trim: true, maxlength: 500 })
  storagePath!: string;

  @Prop({ type: String, required: true, enum: DOCUMENT_STATUSES })
  status!: DocumentStatus;

  @Prop({ type: String, required: false, trim: true, maxlength: 1000 })
  summary?: string;

  @Prop({ type: String, required: false, trim: true, maxlength: 1000 })
  errorMessage?: string;

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
  activeChunkSplitterType?: 'recursive' | 'markdown' | 'token';

  @Prop({ type: Boolean, required: false, default: false })
  activeChunkPreserveSentenceBoundary?: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const DocumentSchema = SchemaFactory.createForClass(Document);

DocumentSchema.index({ userId: 1, createdAt: -1 });
DocumentSchema.index({ userId: 1, status: 1 });
DocumentSchema.index({ userId: 1, knowledgeBaseId: 1, createdAt: -1 });
