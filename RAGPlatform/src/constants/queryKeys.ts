export const queryKeys = {
  auth: {
    profile: ["auth", "profile"] as const,
  },
  knowledgeBases: {
    list: ["knowledge-bases", "list"] as const,
  },
  conversations: {
    list: (knowledgeBaseId: string) =>
      ["conversations", "list", knowledgeBaseId] as const,
  },
  messages: {
    list: (conversationId: string) =>
      ["messages", "list", conversationId] as const,
  },
  documents: {
    list: (knowledgeBaseId: string) =>
      ["documents", "list", knowledgeBaseId] as const,
  },
  ingestion: {
    jobs: ["ingestion", "jobs"] as const,
  },
  chunks: {
    context: (
      knowledgeBaseId: string,
      chunkId: string,
      before: number,
      after: number,
      experimentId?: string,
    ) =>
      ["chunks", "context", knowledgeBaseId, chunkId, before, after, experimentId ?? "production"] as const,
  },
  rag: {
    traces: (conversationId: string) =>
      ["rag", "traces", conversationId] as const,
  },
};
