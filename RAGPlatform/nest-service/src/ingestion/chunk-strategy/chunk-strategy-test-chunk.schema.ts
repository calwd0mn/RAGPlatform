import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { ChunkMetadata } from '../interfaces/chunk-metadata.interface';

export type ChunkStrategyTestChunkDocument =
  HydratedDocument<ChunkStrategyTestChunk>;

@Schema({ timestamps: true, collection: 'chunk_strategy_test_chunks' })
export class ChunkStrategyTestChunk {
  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'Document' })
  documentId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120, index: true })
  testRunId!: string;

  @Prop({ required: true, trim: true, maxlength: 120, index: true })
  strategyName!: string;

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

export const ChunkStrategyTestChunkSchema = SchemaFactory.createForClass(
  ChunkStrategyTestChunk,
);

ChunkStrategyTestChunkSchema.index(
  {
    userId: 1,
    testRunId: 1,
    strategyName: 1,
    documentId: 1,
    chunkIndex: 1,
  },
  { unique: true },
);

ChunkStrategyTestChunkSchema.index({
  userId: 1,
  testRunId: 1,
  strategyName: 1,
  createdAt: -1,
});
