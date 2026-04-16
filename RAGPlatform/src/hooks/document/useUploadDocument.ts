import { useMutation } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { uploadDocument } from "../../services/documents";
import type { ApiErrorPayload } from "../../types/api";
import type { DocumentRecord } from "../../types/document";

export function useUploadDocument() {
  return useMutation<DocumentRecord, AxiosError<ApiErrorPayload>, File>({
    mutationFn: (file) => uploadDocument(file),
  });
}

