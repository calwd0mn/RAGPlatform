export const queryKeys = {
  auth: {
    profile: ["auth", "profile"] as const,
  },
  conversations: {
    list: ["conversations", "list"] as const,
  },
  messages: {
    list: (conversationId: string) =>
      ["messages", "list", conversationId] as const,
  },
  documents: {
    list: ["documents", "list"] as const,
  },
  ingestion: {
    jobs: ["ingestion", "jobs"] as const,
  },
  chunks: {
    context: (chunkId: string, before: number, after: number) =>
      ["chunks", "context", chunkId, before, after] as const,
  },
  rag: {
    traces: (conversationId: string) =>
      ["rag", "traces", conversationId] as const,
  },
};
