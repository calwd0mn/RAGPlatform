import type { DocumentStatus } from "../types/document";

export type DocumentDisplayStatus = "uploaded" | "processing" | "ready" | "failed";

interface DocumentDisplayMeta {
  color: string;
  label: string;
}

const processingStatuses: DocumentStatus[] = [
  "queued",
  "processing",
  "parsing",
  "parsed",
  "chunked",
  "embedded",
];

const statusDisplayMetaMap: Record<DocumentDisplayStatus, DocumentDisplayMeta> = {
  uploaded: {
    color: "default",
    label: "待入库",
  },
  processing: {
    color: "processing",
    label: "处理中",
  },
  ready: {
    color: "success",
    label: "可问答",
  },
  failed: {
    color: "error",
    label: "入库失败",
  },
};

export function toDocumentDisplayStatus(status: DocumentStatus): DocumentDisplayStatus {
  if (status === "ready") {
    return "ready";
  }
  if (status === "failed") {
    return "failed";
  }
  if (processingStatuses.includes(status)) {
    return "processing";
  }
  return "uploaded";
}

export function getDocumentDisplayMeta(status: DocumentStatus): DocumentDisplayMeta {
  const displayStatus = toDocumentDisplayStatus(status);
  return statusDisplayMetaMap[displayStatus];
}

export function isProcessingDocumentStatus(status: DocumentStatus): boolean {
  return toDocumentDisplayStatus(status) === "processing";
}
