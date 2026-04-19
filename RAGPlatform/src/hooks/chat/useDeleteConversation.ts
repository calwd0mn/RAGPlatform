import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { queryKeys } from "../../constants/queryKeys";
import { deleteConversation } from "../../services/conversations";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";
import type { ApiErrorPayload } from "../../types/api";
import type { ConversationItem } from "../../types/chat";

interface DeleteConversationVariables {
  conversationId: string;
}

function removeConversation(
  currentList: ConversationItem[] | undefined,
  conversationId: string,
): ConversationItem[] {
  const existingList = currentList ?? [];
  return existingList.filter((item) => item.id !== conversationId);
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  const knowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );

  return useMutation<void, AxiosError<ApiErrorPayload>, DeleteConversationVariables>({
    mutationFn: (variables) => deleteConversation(variables.conversationId),
    onSuccess: async (_, variables) => {
      queryClient.setQueryData<ConversationItem[]>(
        queryKeys.conversations.list(knowledgeBaseId),
        (currentList) => removeConversation(currentList, variables.conversationId),
      );
      queryClient.removeQueries({
        queryKey: queryKeys.messages.list(variables.conversationId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(knowledgeBaseId),
      });
    },
  });
}
