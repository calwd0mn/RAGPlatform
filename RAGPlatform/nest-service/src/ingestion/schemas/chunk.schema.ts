import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { ChunkMetadata } from '../interfaces/chunk-metadata.interface';

export type ChunkDocument = HydratedDocument<Chunk>;

@Schema({ timestamps: true })
export class Chunk {
  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  knowledgeBaseId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'Document' })
  documentId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  chunkIndex!: number;

  @Prop({ required: true, trim: true })
  content!: string;

  @Prop({ type: [Number], required: true })
  embedding!: number[];

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  metadata!: ChunkMetadata;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ChunkSchema = SchemaFactory.createForClass(Chunk);

ChunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });
ChunkSchema.index({ userId: 1, documentId: 1 });
ChunkSchema.index({ userId: 1, knowledgeBaseId: 1 });
