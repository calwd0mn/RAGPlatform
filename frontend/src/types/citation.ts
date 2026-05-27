export interface CitationWorkspaceSelection {
  conversationId: string;
  assistantMessageId: string;
  citationIndex: number;
  documentId?: string;
  documentName?: string;
  chunkId?: string;
  page?: number;
  content?: string;
  score?: number;
}

