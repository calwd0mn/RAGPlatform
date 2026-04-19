import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { queryKeys } from "../../constants/queryKeys";
import { startIngestion } from "../../services/ingestion";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";
import type { ApiErrorPayload } from "../../types/api";

export function useStartIngestion() {
  const queryClient = useQueryClient();
  const knowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );

  return useMutation<void, AxiosError<ApiErrorPayload>, string>({
    mutationFn: (documentId) => startIngestion(documentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.documents.list(knowledgeBaseId),
      });
    },
  });
}
