import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { queryKeys } from "../../constants/queryKeys";
import { getKnowledgeBases } from "../../services/knowledge-bases";
import type { ApiErrorPayload } from "../../types/api";
import type { KnowledgeBaseRecord } from "../../types/knowledge-base";

export function useKnowledgeBaseList() {
  return useQuery<KnowledgeBaseRecord[], AxiosError<ApiErrorPayload>>({
    queryKey: queryKeys.knowledgeBases.list,
    queryFn: getKnowledgeBases,
  });
}
