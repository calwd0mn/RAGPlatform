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

interface DeleteConversationMutationContext {
  previousConversations?: ConversationItem[];
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
  const conversationListQueryKey = queryKeys.conversations.list(knowledgeBaseId);

  return useMutation<
    void,
    AxiosError<ApiErrorPayload>,
    DeleteConversationVariables,
    DeleteConversationMutationContext
  >({
    mutationFn: (variables) => deleteConversation(variables.conversationId),
    onMutate: async (
      variables,
    ): Promise<DeleteConversationMutationContext> => {
      await queryClient.cancelQueries({
        queryKey: conversationListQueryKey,
      });

      const previousConversations =
        queryClient.getQueryData<ConversationItem[]>(conversationListQueryKey);

      queryClient.setQueryData<ConversationItem[]>(
        conversationListQueryKey,
        (currentList) =>
          removeConversation(currentList, variables.conversationId),
      );

      return { previousConversations };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousConversations) {
        queryClient.setQueryData<ConversationItem[]>(
          conversationListQueryKey,
          context.previousConversations,
        );
      }
    },
    onSuccess: async (_, variables) => {
      queryClient.removeQueries({
        queryKey: queryKeys.messages.list(variables.conversationId),
      });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: conversationListQueryKey,
      });
    },
  });
}
