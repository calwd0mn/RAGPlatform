import type { AxiosRequestConfig } from "axios";
import { http } from "./http";
import type {
  ChunksDebugQuery,
  ChunksDebugResponse,
  DebugExperimentCreateRequest,
  DebugExperimentListResponse,
  DebugExperimentRecord,
  DebugExperimentRunResult,
  DebugExperimentUpdateRequest,
  PublishDebugExperimentRequest,
  PublishDebugExperimentResponse,
  RagPromptCurrentResponse,
  RagPromptRenderRequest,
  RagPromptRenderResponse,
  RagRetrieveDebugRequest,
  RagRetrieveDebugResponse,
  RagRunListResponse,
  RagRunRecord,
} from "../types/debug";

const debugToken = (import.meta.env.VITE_DEBUG_ACCESS_TOKEN ?? "").trim();

function buildDebugConfig(): AxiosRequestConfig {
  if (debugToken.length === 0) {
    return {};
  }

  return {
    headers: {
      "x-debug-token": debugToken,
    },
  };
}

export async function getCurrentPrompt(): Promise<RagPromptCurrentResponse> {
  const response = await http.get<RagPromptCurrentResponse>(
    "/rag/debug/prompt/current",
    buildDebugConfig(),
  );
  return response.data;
}

export async function renderPrompt(
  payload: RagPromptRenderRequest,
): Promise<RagPromptRenderResponse> {
  const response = await http.post<RagPromptRenderResponse>(
    "/rag/debug/prompt/render",
    payload,
    buildDebugConfig(),
  );
  return response.data;
}

export async function debugRetrieve(
  payload: RagRetrieveDebugRequest,
): Promise<RagRetrieveDebugResponse> {
  const response = await http.post<RagRetrieveDebugResponse>(
    "/rag/debug/retrieve",
    payload,
    buildDebugConfig(),
  );
  return response.data;
}

export async function getRagRuns(params: {
  knowledgeBaseId: string;
  limit?: number;
  offset?: number;
  runType?: "ask" | "debug-render" | "debug-retrieve";
  status?: "success" | "error";
}): Promise<RagRunListResponse> {
  const response = await http.get<RagRunListResponse>("/rag/debug/runs", {
    ...buildDebugConfig(),
    params,
  });
  return response.data;
}

export async function getRagRun(runId: string): Promise<RagRunRecord> {
  const response = await http.get<RagRunRecord>(
    `/rag/debug/runs/${runId}`,
    buildDebugConfig(),
  );
  return response.data;
}

export async function getChunksDebug(
  params: ChunksDebugQuery,
): Promise<ChunksDebugResponse> {
  const response = await http.get<ChunksDebugResponse>("/chunks/debug", {
    ...buildDebugConfig(),
    params,
  });
  return response.data;
}

export async function createDebugExperiment(
  payload: DebugExperimentCreateRequest,
): Promise<DebugExperimentRecord> {
  const response = await http.post<DebugExperimentRecord>(
    "/rag/debug/experiments",
    payload,
    buildDebugConfig(),
  );
  return response.data;
}

export async function updateDebugExperiment(
  experimentId: string,
  payload: DebugExperimentUpdateRequest,
): Promise<DebugExperimentRecord> {
  const response = await http.patch<DebugExperimentRecord>(
    `/rag/debug/experiments/${experimentId}`,
    payload,
    buildDebugConfig(),
  );
  return response.data;
}

export async function getDebugExperiments(params: {
  knowledgeBaseId: string;
  limit?: number;
  offset?: number;
  status?: "draft" | "running" | "completed" | "failed" | "published";
}): Promise<DebugExperimentListResponse> {
  const response = await http.get<DebugExperimentListResponse>(
    "/rag/debug/experiments",
    {
      ...buildDebugConfig(),
      params,
    },
  );
  return response.data;
}

export async function getDebugExperiment(
  experimentId: string,
): Promise<DebugExperimentRecord> {
  const response = await http.get<DebugExperimentRecord>(
    `/rag/debug/experiments/${experimentId}`,
    buildDebugConfig(),
  );
  return response.data;
}

export async function runDebugExperiment(
  experimentId: string,
): Promise<DebugExperimentRunResult> {
  const response = await http.post<DebugExperimentRunResult>(
    `/rag/debug/experiments/${experimentId}/run`,
    {},
    buildDebugConfig(),
  );
  return response.data;
}

export async function publishDebugExperiment(
  experimentId: string,
  payload: PublishDebugExperimentRequest,
): Promise<PublishDebugExperimentResponse> {
  const response = await http.post<PublishDebugExperimentResponse>(
    `/rag/debug/experiments/${experimentId}/publish`,
    payload,
    buildDebugConfig(),
  );
  return response.data;
}
