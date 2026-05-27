import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  WorkflowEdge,
  WorkflowNode,
} from '../interfaces/workflow-node.interface';

export type WorkflowDocument = HydratedDocument<Workflow>;

@Schema({ timestamps: true })
export class Workflow {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  knowledgeBaseId!: Types.ObjectId;

  @Prop({ type: Array, required: true, default: [] })
  nodes!: WorkflowNode[];

  @Prop({ type: Array, required: true, default: [] })
  edges!: WorkflowEdge[];

  createdAt!: Date;
  updatedAt!: Date;
}

export const WorkflowSchema = SchemaFactory.createForClass(Workflow);

WorkflowSchema.index({ userId: 1, knowledgeBaseId: 1 }, { unique: true });
