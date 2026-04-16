import { http } from "./http";
import type { ConversationItem } from "../types/chat";

interface ConversationResponse {
  id: string;
  title: string;
  lastMessageAt: string;
}

interface CreateConversationPayload {
  title?: string;
}

function formatTimeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}

function toConversationItem(response: ConversationResponse): ConversationItem {
  return {
    id: response.id,
    title: response.title,
    updatedAt: formatTimeLabel(response.lastMessageAt),
  };
}

export async function getConversations(): Promise<ConversationItem[]> {
  const response = await http.get<ConversationResponse[]>("/conversations");
  return response.data.map(toConversationItem);
}

export async function createConversation(
  payload: CreateConversationPayload = {},
): Promise<ConversationItem> {
  const response = await http.post<ConversationResponse>("/conversations", payload);
  return toConversationItem(response.data);
}
