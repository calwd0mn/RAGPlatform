import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { queryKeys } from "../../constants/queryKeys";
import { startIngestion } from "../../services/ingestion";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";
import type { ApiErrorPayload } from "../../types/api";
import type { DocumentRecord } from "../../types/document";

interface StartIngestionMutationContext {
  previousDocuments?: DocumentRecord[];
}

function markDocumentAsParsing(
  documents: DocumentRecord[] | undefined,
  documentId: string,
): DocumentRecord[] {
  return (documents ?? []).map((document) =>
    document.id === documentId
      ? {
          ...document,
          status: "parsing",
        }
      : document,
  );
}

export function useStartIngestion() {
  const queryClient = useQueryClient();
  const knowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );
  const documentListQueryKey = queryKeys.documents.list(knowledgeBaseId);

  return useMutation<
    void,
    AxiosError<ApiErrorPayload>,
    string,
    StartIngestionMutationContext
  >({
    mutationFn: (documentId) => startIngestion(documentId),
    onMutate: async (documentId): Promise<StartIngestionMutationContext> => {
      await queryClient.cancelQueries({
        queryKey: documentListQueryKey,
      });

      const previousDocuments =
        queryClient.getQueryData<DocumentRecord[]>(documentListQueryKey);

      queryClient.setQueryData<DocumentRecord[]>(
        documentListQueryKey,
        (currentDocuments) => markDocumentAsParsing(currentDocuments, documentId),
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
