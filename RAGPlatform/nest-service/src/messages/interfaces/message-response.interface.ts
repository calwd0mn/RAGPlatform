import { MessageCitation } from './message-citation.interface';
import { MessageGenerationStatus } from './message-generation-status.type';
import { MessageRole } from './message-role.type';
import { MessageTrace } from './message-trace.interface';

export interface MessageResponse {
  id: string;
  conversationId: string;
  userId: string;
  role: MessageRole;
  content: string;
  citations: MessageCitation[];
  trace?: MessageTrace;
  requestId?: string;
  status: MessageGenerationStatus;
  createdAt: Date;
  updatedAt: Date;
}
