import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MessageCitation } from '../interfaces/message-citation.interface';
import { MessageRole, MESSAGE_ROLES } from '../interfaces/message-role.type';
import { MessageTrace } from '../interfaces/message-trace.interface';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ _id: false })
class MessageCitationSchemaClass implements MessageCitation {
  @Prop()
  documentId?: string;

  @Prop()
  chunkId?: string;

  @Prop()
  documentName?: string;

  @Prop()
  content?: string;

  @Prop()
  score?: number;

  @Prop()
  page?: number;
}

@Schema({ _id: false })
class MessageTraceSchemaClass implements MessageTrace {
  @Prop()
  knowledgeBaseId?: string;

  @Prop()
  query?: string;

  @Prop()
  rewrittenQuery?: string;

  @Prop()
  topK?: number;

  @Prop()
  retrievedCount?: number;

  @Prop()
  contextChunkCount?: number;

  @Prop()
  contextCharCount?: number;

  @Prop()
  contextTrimmed?: boolean;

  @Prop()
  model?: string;

  @Prop()
  retrievalProvider?: string;

  @Prop()
  promptVersion?: string;

  @Prop()
  latencyMs?: number;
}

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  conversationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, enum: MESSAGE_ROLES })
  role!: MessageRole;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 10000 })
  content!: string;

  @Prop({ type: [MessageCitationSchemaClass], default: [] })
  citations!: MessageCitation[];

  @Prop({ type: MessageTraceSchemaClass, required: false })
  trace?: MessageTrace;

  createdAt!: Date;
  updatedAt!: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index({ userId: 1, conversationId: 1 });
