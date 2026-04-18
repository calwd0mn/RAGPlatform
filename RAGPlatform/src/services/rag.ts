import { http, notifyUnauthorized } from "./http";
import type { ApiErrorPayload } from "../types/api";
import type { RagAskRequest, RagAskResponse } from "../types/rag";
import { getAccessToken } from "../utils/token";

export async function askRag(payload: RagAskRequest): Promise<RagAskResponse> {
  const response = await http.post<RagAskResponse>("/rag/ask", payload);
  return response.data;
}

interface RagAskStreamCallbacks {
  onToken?: (token: string) => void;
  signal?: AbortSignal;
}

interface StreamTokenPayload {
  text?: string;
}

interface StreamErrorPayload {
  message?: string | string[];
}

function buildStreamUrl(): string {
  const rawBaseUrl = (http.defaults.baseURL ?? "/api").trim();
  if (rawBaseUrl.endsWith("/")) {
    return `${rawBaseUrl}rag/ask/stream`;
  }
  return `${rawBaseUrl}/rag/ask/stream`;
}

function parseApiErrorMessage(payload: ApiErrorPayload): string {
  if (Array.isArray(payload.message)) {
    return payload.message.join("；");
  }
  return payload.message;
}

function parseEventBlock(
  rawBlock: string,
): { event: string; data: string } | null {
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

  return {
    event,
    data: dataLines.join("\n"),
  };
}

export async function askRagStream(
  payload: RagAskRequest,
  callbacks: RagAskStreamCallbacks,
): Promise<RagAskResponse> {
  const accessToken = getAccessToken();
  const response = await fetch(buildStreamUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(payload),
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
      // ignore parse error and keep fallback message
    }
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error("流式响应体为空");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let finalResponse: RagAskResponse | null = null;

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
      const parsedEvent = parseEventBlock(block);

      if (parsedEvent) {
        if (parsedEvent.event === "token") {
          const tokenPayload = JSON.parse(parsedEvent.data) as StreamTokenPayload;
          if (typeof tokenPayload.text === "string" && tokenPayload.text.length > 0) {
            callbacks.onToken?.(tokenPayload.text);
          }
        } else if (parsedEvent.event === "final") {
          finalResponse = JSON.parse(parsedEvent.data) as RagAskResponse;
        } else if (parsedEvent.event === "error") {
          const errorPayload = JSON.parse(parsedEvent.data) as StreamErrorPayload;
          const resolvedMessage = Array.isArray(errorPayload.message)
            ? errorPayload.message.join("；")
            : errorPayload.message ?? "流式响应失败";
          throw new Error(resolvedMessage);
        }
      }

      separatorIndex = buffer.indexOf("\n\n");
    }
  }

  buffer += decoder.decode().replace(/\r/g, "");
  if (buffer.trim().length > 0) {
    const trailingEvent = parseEventBlock(buffer.trim());
    if (trailingEvent?.event === "final") {
      finalResponse = JSON.parse(trailingEvent.data) as RagAskResponse;
    }
    if (trailingEvent?.event === "error") {
      const trailingErrorPayload = JSON.parse(trailingEvent.data) as StreamErrorPayload;
      const trailingMessage = Array.isArray(trailingErrorPayload.message)
        ? trailingErrorPayload.message.join("；")
        : trailingErrorPayload.message ?? "流式响应失败";
      throw new Error(trailingMessage);
    }
  }

  if (!finalResponse) {
    throw new Error("流式响应未返回 final 事件");
  }

  return finalResponse;
}
