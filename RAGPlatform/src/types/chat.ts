import type { RagCitation, RagTrace } from "./rag";

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
}

export type CitationItem = RagCitation;
