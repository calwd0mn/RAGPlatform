export type DocumentStatus = "queued" | "processing" | "ready" | "failed";

export interface DocumentRecord {
  id: string;
  filename: string;
  fileType: string;
  sizeLabel: string;
  status: DocumentStatus;
  createdAt: string;
}
