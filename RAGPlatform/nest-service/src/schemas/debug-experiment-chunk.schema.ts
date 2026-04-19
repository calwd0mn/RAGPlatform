import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { ChunkMetadata } from '../ingestion/interfaces/chunk-metadata.interface';
import { ChunkStrategyDraft } from './debug-experiment.schema';

export type DebugExperimentChunkDocument =
  HydratedDocument<DebugExperimentChunk>;

@Schema({ timestamps: true, collection: 'debug_experiment_chunks' })
export class DebugExperimentChunk {
  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  knowledgeBaseId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'Document' })
  documentId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'DebugExperiment' })
  experimentId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120, index: true })
  chunkNamespace!: string;

  @Prop({ required: true, trim: true, maxlength: 120, index: true })
  strategyName!: string;

  @Prop({ type: ChunkStrategyDraft, required: true })
  strategySnapshot!: ChunkStrategyDraft;

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

export const DebugExperimentChunkSchema =
  SchemaFactory.createForClass(DebugExperimentChunk);

DebugExperimentChunkSchema.index(
  {
    userId: 1,
    experimentId: 1,
    strategyName: 1,
    documentId: 1,
    chunkIndex: 1,
  },
  { unique: true },
);

DebugExperimentChunkSchema.index({
  userId: 1,
  chunkNamespace: 1,
  strategyName: 1,
  createdAt: -1,
});
