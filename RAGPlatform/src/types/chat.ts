import type { RagCitation, RagTrace } from "./rag";

export type MessageGenerationStatus =
  | "streaming"
  | "completed"
  | "interrupted"
  | "failed";

export interface ConversationItem {
  id: string;
  knowledgeBaseId: string;
  title: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  citations?: RagCitation[];
  trace?: RagTrace;
  requestId?: string;
  status?: MessageGenerationStatus;
}

export type CitationItem = RagCitation;
