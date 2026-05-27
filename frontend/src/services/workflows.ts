import { getAccessToken } from "../utils/token";
import { http, notifyUnauthorized } from "./http";
import type {
  WorkflowEdge,
  WorkflowNode,
  WorkflowRecord,
  WorkflowRunInputs,
  WorkflowStreamEvent,
} from "../types/workflow";
import type { ApiErrorPayload } from "../types/api";

export async function getCurrentWorkflow(
  knowledgeBaseId: string,
): Promise<WorkflowRecord> {
  const response = await http.get<WorkflowRecord>("/workflows/current", {
    params: { knowledgeBaseId },
  });
  return response.data;
}

export async function updateWorkflow(
  workflowId: string,
  payload: { nodes: WorkflowNode[]; edges: WorkflowEdge[] },
): Promise<WorkflowRecord> {
  const response = await http.patch<WorkflowRecord>(
    `/workflows/${workflowId}`,
    payload,
  );
  return response.data;
}

interface StreamCallbacks {
  onEvent: (event: WorkflowStreamEvent) => void;
  signal?: AbortSignal;
}

interface ParsedEventBlock {
  event: string;
  data: string;
}

function buildWorkflowStreamUrl(workflowId: string): string {
  const rawBaseUrl = (http.defaults.baseURL ?? "/api").trim();
  const normalizedBaseUrl = rawBaseUrl.endsWith("/")
    ? rawBaseUrl.slice(0, -1)
    : rawBaseUrl;
  return `${normalizedBaseUrl}/workflows/${workflowId}/run/stream`;
}

function parseEventBlock(rawBlock: string): ParsedEventBlock | null {
  const lines = rawBlock
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return null;
  }

  let event = "message";
  const dataLines: string[] = [];

  lines.forEach((line) => {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      return;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  });

  if (dataLines.length === 0) {
    return null;
  }

  return { event, data: dataLines.join("\n") };
}

function toWorkflowStreamEvent(parsed: ParsedEventBlock): WorkflowStreamEvent {
  if (parsed.event === "node_status") {
    return {
      event: "node_status",
      data: JSON.parse(parsed.data) as WorkflowStreamEvent["data"],
    } as WorkflowStreamEvent;
  }
  if (parsed.event === "final") {
    return {
      event: "final",
      data: JSON.parse(parsed.data) as WorkflowStreamEvent["data"],
    } as WorkflowStreamEvent;
  }
  if (parsed.event === "error") {
    return {
      event: "error",
      data: JSON.parse(parsed.data) as { message: string },
    };
  }
  return {
    event: "error",
    data: { message: `未知工作流事件：${parsed.event}` },
  };
}

function parseApiErrorMessage(payload: ApiErrorPayload): string {
  return Array.isArray(payload.message)
    ? payload.message.join("；")
    : payload.message;
}

export async function runWorkflowStream(
  workflowId: string,
  inputs: WorkflowRunInputs,
  callbacks: StreamCallbacks,
): Promise<void> {
  const accessToken = getAccessToken();
  const response = await fetch(buildWorkflowStreamUrl(workflowId), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ inputs }),
    signal: callbacks.signal,
  });

  if (response.status === 401) {
    notifyUnauthorized();
  }

  if (!response.ok) {
    let errorMessage = `请求失败（${response.status}）`;
    try {
      const errorPayload = (await response.json()) as ApiErrorPayload;
      if (errorPayload?.message) {
        errorMessage = parseApiErrorMessage(errorPayload);
      }
    } catch {
      // Keep fallback message.
    }
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error("流式响应体为空");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");
    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex >= 0) {
      const block = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      const parsed = parseEventBlock(block);
      if (parsed) {
        callbacks.onEvent(toWorkflowStreamEvent(parsed));
      }
      separatorIndex = buffer.indexOf("\n\n");
    }
  }

  buffer += decoder.decode().replace(/\r/g, "");
  const trailing = parseEventBlock(buffer.trim());
  if (trailing) {
    callbacks.onEvent(toWorkflowStreamEvent(trailing));
  }
}

