import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { queryKeys } from "../../constants/queryKeys";
import { getDocuments } from "../../services/documents";
import type { ApiErrorPayload } from "../../types/api";
import type { DocumentRecord } from "../../types/document";
import { isProcessingDocumentStatus } from "../../utils/document-status";

export function useDocumentList() {
  return useQuery<DocumentRecord[], AxiosError<ApiErrorPayload>>({
    queryKey: queryKeys.documents.list,
    queryFn: getDocuments,
    refetchInterval: (query) => {
      const documents = query.state.data;
      if (!documents || documents.length === 0) {
        return false;
      }
      return documents.some((item) => isProcessingDocumentStatus(item.status)) ? 4_000 : false;
    },
  });
}
