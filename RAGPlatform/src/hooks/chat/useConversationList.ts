import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { queryKeys } from "../../constants/queryKeys";
import { getConversations } from "../../services/conversations";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";
import type { ApiErrorPayload } from "../../types/api";
import type { ConversationItem } from "../../types/chat";

export function useConversationList() {
  const knowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );

  return useQuery<ConversationItem[], AxiosError<ApiErrorPayload>>({
    queryKey: queryKeys.conversations.list(knowledgeBaseId),
    queryFn: () => getConversations(knowledgeBaseId),
    enabled: knowledgeBaseId.length > 0,
  });
}
