import { http } from "./http";
import type { ApiResponse } from "../types/api";
import type { DocumentRecord } from "../types/document";

export async function getDocuments(): Promise<DocumentRecord[]> {
  const response = await http.get<ApiResponse<DocumentRecord[]>>("/documents");
  return response.data.data;
}
