export interface ConversationItem {
  id: string;
  title: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface CitationItem {
  id: string;
  sourceName: string;
  excerpt: string;
  score: number;
}

export interface TraceItem {
  id: string;
  step: string;
  detail: string;
  elapsedMs: number;
}
