import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { queryKeys } from "../../constants/queryKeys";
import { deleteDocument } from "../../services/documents";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";
import type { ApiErrorPayload } from "../../types/api";
import type { DocumentRecord } from "../../types/document";

interface DeleteDocumentMutationContext {
  previousDocuments?: DocumentRecord[];
}

function removeDocument(
  documents: DocumentRecord[] | undefined,
  documentId: string,
): DocumentRecord[] {
  return (documents ?? []).filter((document) => document.id !== documentId);
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  const knowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );
  const documentListQueryKey = queryKeys.documents.list(knowledgeBaseId);

  return useMutation<
    void,
    AxiosError<ApiErrorPayload>,
    string,
    DeleteDocumentMutationContext
  >({
    mutationFn: (documentId) => deleteDocument(documentId),
    onMutate: async (documentId): Promise<DeleteDocumentMutationContext> => {
      await queryClient.cancelQueries({
        queryKey: documentListQueryKey,
      });

      const previousDocuments =
        queryClient.getQueryData<DocumentRecord[]>(documentListQueryKey);

      queryClient.setQueryData<DocumentRecord[]>(
        documentListQueryKey,
        (currentDocuments) => removeDocument(currentDocuments, documentId),
      );

      return { previousDocuments };
    },
    onError: (_error, _documentId, context) => {
      if (context?.previousDocuments) {
        queryClient.setQueryData<DocumentRecord[]>(
          documentListQueryKey,
          context.previousDocuments,
        );
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: documentListQueryKey,
      });
    },
  });
}
