import { DocumentStatus } from './document-status.type';

export interface DocumentResponse {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: DocumentStatus;
  summary?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}
