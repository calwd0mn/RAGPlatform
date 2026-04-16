import { DocumentStatus } from '../../documents/interfaces/document-status.type';

export interface IngestionResult {
  documentId: string;
  finalStatus: DocumentStatus;
  chunkCount: number;
  message: string;
}
