export enum DocumentStatusEnum {
  Uploaded = 'uploaded',
  Parsing = 'parsing',
  Parsed = 'parsed',
  Chunked = 'chunked',
  Embedded = 'embedded',
  Ready = 'ready',
  Failed = 'failed',
}

export const DOCUMENT_STATUSES = [
  DocumentStatusEnum.Uploaded,
  DocumentStatusEnum.Parsing,
  DocumentStatusEnum.Parsed,
  DocumentStatusEnum.Chunked,
  DocumentStatusEnum.Embedded,
  DocumentStatusEnum.Ready,
  DocumentStatusEnum.Failed,
] as const;

export type DocumentStatus = DocumentStatusEnum;
