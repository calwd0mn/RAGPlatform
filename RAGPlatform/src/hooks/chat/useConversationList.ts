import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { queryKeys } from "../../constants/queryKeys";
import { getConversations } from "../../services/conversations";
import type { ApiErrorPayload } from "../../types/api";
import type { ConversationItem } from "../../types/chat";

export function useConversationList() {
  return useQuery<ConversationItem[], AxiosError<ApiErrorPayload>>({
    queryKey: queryKeys.conversations.list,
    queryFn: getConversations,
  });
}
