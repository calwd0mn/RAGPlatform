import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { queryKeys } from "../../constants/queryKeys";
import { deleteDocument } from "../../services/documents";
import type { ApiErrorPayload } from "../../types/api";

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation<void, AxiosError<ApiErrorPayload>, string>({
    mutationFn: (documentId) => deleteDocument(documentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.documents.list });
    },
  });
}
