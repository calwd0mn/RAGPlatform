import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { queryKeys } from "../../constants/queryKeys";
import { createConversation } from "../../services/conversations";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";
import type { ApiErrorPayload } from "../../types/api";
import type { ConversationItem } from "../../types/chat";

function upsertConversationList(
  currentList: ConversationItem[] | undefined,
  createdConversation: ConversationItem,
): ConversationItem[] {
  const existingList = currentList ?? [];
  const withoutCreated = existingList.filter(
    (conversation) => conversation.id !== createdConversation.id,
  );
  return [createdConversation, ...withoutCreated];
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  const knowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );

  return useMutation<ConversationItem, AxiosError<ApiErrorPayload>, { title?: string }>({
    mutationFn: (payload) =>
      createConversation({ knowledgeBaseId, title: payload.title }),
    onSuccess: (createdConversation) => {
      queryClient.setQueryData<ConversationItem[]>(
        queryKeys.conversations.list(knowledgeBaseId),
        (currentList) => upsertConversationList(currentList, createdConversation),
      );
    },
  });
}
