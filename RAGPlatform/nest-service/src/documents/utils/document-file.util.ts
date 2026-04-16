import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage, FileFilterCallback } from 'multer';
import { extname, isAbsolute, join, relative } from 'path';
import { mkdirSync, promises as fsPromises } from 'fs';
import { randomUUID } from 'crypto';
import {
  DOCUMENT_ALLOWED_EXTENSIONS,
  DOCUMENT_ALLOWED_MIME_TYPES,
  DOCUMENT_MAX_FILE_SIZE,
  DOCUMENT_UPLOAD_DIR,
} from '../constants/document.constants';
import { UploadedDocumentFile } from '../interfaces/uploaded-document-file.interface';

function normalizePath(pathValue: string): string {
  return pathValue.replace(/\\/g, '/');
}

function containsCjk(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

export function normalizeUploadedOriginalName(originalName: string): string {
  if (!originalName) {
    return originalName;
  }

  if (containsCjk(originalName)) {
    return originalName;
  }

  const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
  if (decoded.includes('�')) {
    return originalName;
  }

  if (containsCjk(decoded)) {
    return decoded;
  }

  return originalName;
}

export function getDocumentExtension(filename: string): string {
  return extname(filename).toLowerCase();
}

export function isAllowedDocumentFileType(mimeType: string, originalName: string): boolean {
  const fileExtension = getDocumentExtension(originalName);
  const allowedMimeTypes: readonly string[] = DOCUMENT_ALLOWED_MIME_TYPES;
  const allowedExtensions: readonly string[] = DOCUMENT_ALLOWED_EXTENSIONS;
  return allowedMimeTypes.includes(mimeType) && allowedExtensions.includes(fileExtension);
}

export function buildDocumentStoragePath(absoluteFilePath: string): string {
  const relativePath = relative(process.cwd(), absoluteFilePath);
  return normalizePath(relativePath);
}

export function toDocumentAbsolutePath(storagePath: string): string {
  return isAbsolute(storagePath) ? storagePath : join(process.cwd(), storagePath);
}

export async function removeStoredDocumentFile(storagePath: string): Promise<void> {
  await fsPromises.rm(toDocumentAbsolutePath(storagePath), { force: true });
}

function ensureDocumentUploadDir(): void {
  mkdirSync(DOCUMENT_UPLOAD_DIR, { recursive: true });
}

export const DOCUMENT_MULTER_OPTIONS: MulterOptions = {
  storage: diskStorage({
    destination: (_request, _file, callback): void => {
      ensureDocumentUploadDir();
      callback(null, DOCUMENT_UPLOAD_DIR);
    },
    filename: (_request, file: UploadedDocumentFile, callback): void => {
      const normalizedOriginalName = normalizeUploadedOriginalName(file.originalname);
      const fileExtension = getDocumentExtension(normalizedOriginalName);
      callback(null, `${randomUUID()}${fileExtension}`);
    },
  }),
  limits: {
    fileSize: DOCUMENT_MAX_FILE_SIZE,
  },
  fileFilter: (_request, file: UploadedDocumentFile, callback: FileFilterCallback): void => {
    const normalizedOriginalName = normalizeUploadedOriginalName(file.originalname);
    if (!isAllowedDocumentFileType(file.mimetype, normalizedOriginalName)) {
      callback(new BadRequestException('Invalid file type'));
      return;
    }

    callback(null, true);
  },
};
