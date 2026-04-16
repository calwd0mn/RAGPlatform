import { RagCitation } from './rag-citation.interface';
import { RagTrace } from './rag-trace.interface';

export interface RagAnswer {
  answer: string;
  citations: RagCitation[];
  trace: RagTrace;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
}