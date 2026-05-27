import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { queryKeys } from "../../constants/queryKeys";
import { askRag } from "../../services/rag";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";
import type { ApiErrorPayload } from "../../types/api";
import type { RagAskRequest, RagAskResponse } from "../../types/rag";

export function useRagAsk() {
  const queryClient = useQueryClient();
  const knowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );

  return useMutation<RagAskResponse, AxiosError<ApiErrorPayload>, RagAskRequest>({
    mutationFn: (variables) => askRag(variables),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.messages.list(data.conversationId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.conversations.list(knowledgeBaseId),
        }),
      ]);
    },
  });
}
