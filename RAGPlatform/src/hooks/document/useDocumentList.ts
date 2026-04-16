import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { queryKeys } from "../../constants/queryKeys";
import { getDocuments } from "../../services/documents";
import type { ApiErrorPayload } from "../../types/api";
import type { DocumentRecord } from "../../types/document";

export function useDocumentList() {
  return useQuery<DocumentRecord[], AxiosError<ApiErrorPayload>>({
    queryKey: queryKeys.documents.list,
    queryFn: getDocuments,
  });
}

