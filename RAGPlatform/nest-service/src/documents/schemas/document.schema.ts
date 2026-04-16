import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { DOCUMENT_STATUSES, DocumentStatus } from '../interfaces/document-status.type';

export type DocumentDocument = HydratedDocument<Document>;

@Schema({ timestamps: true })
export class Document {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 255 })
  filename!: string;

  @Prop({ required: true, trim: true, maxlength: 255 })
  originalName!: string;

  @Prop({ required: true, trim: true, maxlength: 100 })
  mimeType!: string;

  @Prop({ required: true, min: 1 })
  size!: number;

  @Prop({ required: true, trim: true, maxlength: 500 })
  storagePath!: string;

  @Prop({ required: true, enum: DOCUMENT_STATUSES })
  status!: DocumentStatus;

  @Prop({ required: false, trim: true, maxlength: 1000 })
  summary?: string;

  @Prop({ required: false, trim: true, maxlength: 1000 })
  errorMessage?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const DocumentSchema = SchemaFactory.createForClass(Document);

DocumentSchema.index({ userId: 1, createdAt: -1 });
DocumentSchema.index({ userId: 1, status: 1 });
