export type DocumentStatus =
  | "uploaded"
  | "parsing"
  | "parsed"
  | "chunked"
  | "embedded"
  | "ready"
  | "failed"
  | "queued"
  | "processing";

export interface DocumentRecord {
  id: string;
  knowledgeBaseId: string;
  filename: string;
  fileType: string;
  sizeLabel: string;
  status: DocumentStatus;
  createdAt: string;
}
