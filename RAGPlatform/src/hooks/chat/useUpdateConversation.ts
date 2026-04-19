import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { queryKeys } from "../../constants/queryKeys";
import { updateConversation } from "../../services/conversations";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";
import type { ApiErrorPayload } from "../../types/api";
import type { ConversationItem } from "../../types/chat";

interface UpdateConversationVariables {
  conversationId: string;
  title: string;
}

function replaceConversation(
  currentList: ConversationItem[] | undefined,
  updatedConversation: ConversationItem,
): ConversationItem[] {
  const existingList = currentList ?? [];
  return existingList.map((item) =>
    item.id === updatedConversation.id ? updatedConversation : item,
  );
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();
  const knowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );

  return useMutation<
    ConversationItem,
    AxiosError<ApiErrorPayload>,
    UpdateConversationVariables
  >({
    mutationFn: (variables) =>
      updateConversation(variables.conversationId, { title: variables.title }),
    onSuccess: async (updatedConversation) => {
      queryClient.setQueryData<ConversationItem[]>(
        queryKeys.conversations.list(knowledgeBaseId),
        (currentList) => replaceConversation(currentList, updatedConversation),
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(knowledgeBaseId),
      });
    },
  });
}
