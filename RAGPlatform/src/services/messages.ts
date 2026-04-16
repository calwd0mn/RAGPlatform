import { http } from "./http";
import type { ChatMessage } from "../types/chat";
import type { RagCitation, RagTrace } from "../types/rag";

interface MessageResponse {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  citations?: RagCitation[];
  trace?: RagTrace;
}

export interface SendMessagePayload {
  conversationId: string;
  content: string;
}

function formatTimeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString("zh-CN", { hour12: false });
}

function toChatMessage(response: MessageResponse): ChatMessage {
  return {
    id: response.id,
    role: response.role === "assistant" ? "assistant" : "user",
    content: response.content,
    createdAt: formatTimeLabel(response.createdAt),
    citations: response.citations,
    trace: response.trace,
  };
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const response = await http.get<MessageResponse[]>(
    `/messages/conversation/${conversationId}`,
  );
  return response.data.map(toChatMessage);
}

export async function sendMessage(payload: SendMessagePayload): Promise<ChatMessage> {
  const response = await http.post<MessageResponse>("/messages", {
    conversationId: payload.conversationId,
    role: "user",
    content: payload.content,
  });
  return toChatMessage(response.data);
}
