import { useMutation } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { uploadDocument } from "../../services/documents";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";
import type { ApiErrorPayload } from "../../types/api";
import type { DocumentRecord } from "../../types/document";

export function useUploadDocument() {
  const knowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );

  return useMutation<DocumentRecord, AxiosError<ApiErrorPayload>, File>({
    mutationFn: (file) => uploadDocument(file, knowledgeBaseId),
  });
}
