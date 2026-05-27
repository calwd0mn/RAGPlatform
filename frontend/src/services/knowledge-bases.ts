import { http } from "./http";
import type { KnowledgeBaseRecord } from "../types/knowledge-base";

interface KnowledgeBaseResponse {
  id: string;
  name: string;
  isDefault: boolean;
  activeChunkStrategyName?: string;
  activeChunkStrategyVersion?: string;
  activeChunkSize?: number;
  activeChunkOverlap?: number;
  activeChunkSplitterType?: "recursive" | "markdown" | "token";
  activeChunkPreserveSentenceBoundary?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateKnowledgeBaseSettingsPayload {
  name?: string;
  clearActiveChunkStrategy?: boolean;
  chunkStrategy?: {
    name?: string;
    version?: string;
    chunkSize: number;
    chunkOverlap: number;
    splitterType?: "recursive" | "markdown" | "token";
    preserveSentenceBoundary?: boolean;
  };
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("zh-CN", { hour12: false });
}

function toKnowledgeBaseRecord(
  response: KnowledgeBaseResponse,
): KnowledgeBaseRecord {
  return {
    id: response.id,
    name: response.name,
    isDefault: response.isDefault,
    activeChunkStrategyName: response.activeChunkStrategyName,
    activeChunkStrategyVersion: response.activeChunkStrategyVersion,
    activeChunkSize: response.activeChunkSize,
    activeChunkOverlap: response.activeChunkOverlap,
    activeChunkSplitterType: response.activeChunkSplitterType,
    activeChunkPreserveSentenceBoundary:
      response.activeChunkPreserveSentenceBoundary,
    createdAt: formatDateTime(response.createdAt),
    updatedAt: formatDateTime(response.updatedAt),
  };
}

export async function getKnowledgeBases(): Promise<KnowledgeBaseRecord[]> {
  const response = await http.get<KnowledgeBaseResponse[]>("/knowledge-bases");
  return response.data.map(toKnowledgeBaseRecord);
}

export async function createKnowledgeBase(
  name: string,
): Promise<KnowledgeBaseRecord> {
  const response = await http.post<KnowledgeBaseResponse>("/knowledge-bases", {
    name,
  });
  return toKnowledgeBaseRecord(response.data);
}

export async function updateKnowledgeBase(
  knowledgeBaseId: string,
  name: string,
): Promise<KnowledgeBaseRecord> {
  const response = await http.patch<KnowledgeBaseResponse>(
    `/knowledge-bases/${knowledgeBaseId}`,
    {
      name,
    },
  );
  return toKnowledgeBaseRecord(response.data);
}

export async function updateKnowledgeBaseSettings(
  knowledgeBaseId: string,
  payload: UpdateKnowledgeBaseSettingsPayload,
): Promise<KnowledgeBaseRecord> {
  const response = await http.patch<KnowledgeBaseResponse>(
    `/knowledge-bases/${knowledgeBaseId}`,
    payload,
  );
  return toKnowledgeBaseRecord(response.data);
}

export async function deleteKnowledgeBase(
  knowledgeBaseId: string,
): Promise<void> {
  await http.delete(`/knowledge-bases/${knowledgeBaseId}`);
}
