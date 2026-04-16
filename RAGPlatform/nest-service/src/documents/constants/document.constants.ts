import { join } from 'path';

export const DOCUMENT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
] as const;

export const DOCUMENT_ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md'] as const;

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const parsedMaxSize = Number(process.env.DOCUMENT_MAX_FILE_SIZE_BYTES);

export const DOCUMENT_MAX_FILE_SIZE =
  Number.isFinite(parsedMaxSize) && parsedMaxSize > 0
    ? parsedMaxSize
    : DEFAULT_MAX_FILE_SIZE_BYTES;

export const DOCUMENT_UPLOAD_DIR =
  process.env.DOCUMENTS_UPLOAD_DIR?.trim() ||
  join(process.cwd(), 'uploads', 'documents');
