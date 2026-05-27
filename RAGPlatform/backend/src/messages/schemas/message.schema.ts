import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MessageCitation } from '../interfaces/message-citation.interface';
import {
  MESSAGE_GENERATION_STATUSES,
  MessageGenerationStatus,
} from '../interfaces/message-generation-status.type';
import { MessageRole, MESSAGE_ROLES } from '../interfaces/message-role.type';
import { MessageTrace } from '../interfaces/message-trace.interface';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ _id: false })
class MessageCitationSchemaClass implements MessageCitation {
  @Prop({ type: String })
  documentId?: string;

  @Prop({ type: String })
  chunkId?: string;

  @Prop({ type: String })
  documentName?: string;

  @Prop({ type: String })
  content?: string;

  @Prop({ type: Number })
  score?: number;

  @Prop({ type: Number })
  page?: number;
}

@Schema({ _id: false })
class MessageTraceSchemaClass implements MessageTrace {
  @Prop({ type: String })
  mode?: 'rag' | 'chat';

  @Prop({ type: String })
  knowledgeBaseId?: string;

  @Prop({ type: String })
  query?: string;

  @Prop({ type: String })
  rewrittenQuery?: string;

  @Prop({ type: Number })
  topK?: number;

  @Prop({ type: Number })
  retrievedCount?: number;

  @Prop({ type: Number })
  contextChunkCount?: number;

  @Prop({ type: Number })
  contextCharCount?: number;

  @Prop({ type: Boolean })
  contextTrimmed?: boolean;

  @Prop({ type: String })
  model?: string;

  @Prop({ type: String })
  retrievalProvider?: string;

  @Prop({ type: String })
  promptVersion?: string;

  @Prop({ type: Number })
  latencyMs?: number;
}

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  conversationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: MESSAGE_ROLES })
  role!: MessageRole;

  @Prop({ type: String, required: true, trim: true, minlength: 1, maxlength: 10000 })
  content!: string;

  @Prop({ type: [MessageCitationSchemaClass], default: [] })
  citations!: MessageCitation[];

  @Prop({ type: MessageTraceSchemaClass, required: false })
  trace?: MessageTrace;

  @Prop({ type: String, required: false, trim: true, maxlength: 80, index: true })
  requestId?: string;

  @Prop({
    type: String,
    required: true,
    enum: MESSAGE_GENERATION_STATUSES,
    default: 'completed',
  })
  status!: MessageGenerationStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index({ userId: 1, conversationId: 1 });
MessageSchema.index(
  { userId: 1, requestId: 1, role: 1 },
  {
    unique: true,
    partialFilterExpression: { requestId: { $type: 'string' } },
  },
);
