import { http } from "./http";
import type { ApiResponse } from "../types/api";

export interface IngestionJob {
  id: string;
  status: "queued" | "processing" | "done" | "failed";
  createdAt: string;
}

export async function getIngestionJobs(): Promise<IngestionJob[]> {
  const response = await http.get<ApiResponse<IngestionJob[]>>("/ingestion/jobs");
  return response.data.data;
}
