import { http } from "./http";
import type { ApiResponse } from "../types/api";
import type { CitationItem, TraceItem } from "../types/chat";

export interface RagContext {
  citations: CitationItem[];
  traces: TraceItem[];
}

export async function getRagContext(conversationId: string): Promise<RagContext> {
  const response = await http.get<ApiResponse<RagContext>>(
    `/rag/conversations/${conversationId}/context`,
  );
  return response.data.data;
}
