import { http } from "./http";
import type { ApiResponse } from "../types/api";

interface StartIngestionPayload {
  id?: string;
  status?: string;
}

export async function startIngestion(documentId: string): Promise<void> {
  await http.post<StartIngestionPayload | ApiResponse<StartIngestionPayload>>(
    `/ingestion/${documentId}/start`,
  );
}
