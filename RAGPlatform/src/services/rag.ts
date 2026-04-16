import { http } from "./http";
import type { RagAskRequest, RagAskResponse } from "../types/rag";

export async function askRag(payload: RagAskRequest): Promise<RagAskResponse> {
  const response = await http.post<RagAskResponse>("/rag/ask", payload);
  return response.data;
}
