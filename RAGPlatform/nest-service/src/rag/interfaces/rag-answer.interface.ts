import { RagCitation } from './rag-citation.interface';
import { RagTrace } from './rag-trace.interface';
import { MessageGenerationStatus } from '../../messages/interfaces/message-generation-status.type';

export interface RagAnswer {
  answer: string;
  citations: RagCitation[];
  trace: RagTrace;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  requestId?: string;
  status: MessageGenerationStatus;
}
