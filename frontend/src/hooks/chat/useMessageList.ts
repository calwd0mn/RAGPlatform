import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { queryKeys } from "../../constants/queryKeys";
import { getMessages } from "../../services/messages";
import type { ApiErrorPayload } from "../../types/api";
import type { ChatMessage } from "../../types/chat";

export function useMessageList(conversationId: string | undefined) {
  return useQuery<ChatMessage[], AxiosError<ApiErrorPayload>>({
    queryKey: queryKeys.messages.list(conversationId ?? ""),
    queryFn: () => getMessages(conversationId ?? ""),
    enabled: Boolean(conversationId),
  });
}
