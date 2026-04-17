import { http } from "./http";
import type { DocumentRecord } from "../types/document";

interface DocumentApiItem {
  id: string;
  filename: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  status: DocumentRecord["status"];
  createdAt: string;
}

interface ApiResponseLike<TData> {
  data: TData;
}

function containsCjk(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function decodePossibleMojibake(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }

  if (containsCjk(value)) {
    return value;
  }

  let decoded = value;
  try {
    decoded = decodeURIComponent(
      value
        .split("")
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
  } catch {
    return value;
  }

  if (decoded.includes("�")) {
    return value;
  }

  if (containsCjk(decoded)) {
    return decoded;
  }

  return value;
}

function normalizeFileType(input: DocumentApiItem): string {
  if (input.mimeType && input.mimeType.includes("/")) {
    const suffix = input.mimeType.split("/")[1];
    if (suffix) {
      return suffix.toUpperCase();
    }
  }

  const name = input.originalName || input.filename;
  const parts = name.split(".");
  if (parts.length > 1) {
    const extension = parts[parts.length - 1];
    if (extension) {
      return extension.toUpperCase();
    }
  }
  return "-";
}

function formatSizeLabel(size: number | undefined): string {
  if (typeof size !== "number" || size < 0) {
    return "-";
  }
  if (size < 1024) {
    return `${size} B`;
  }
  const kilo = size / 1024;
  if (kilo < 1024) {
    return `${kilo.toFixed(1)} KB`;
  }
  return `${(kilo / 1024).toFixed(1)} MB`;
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("zh-CN", { hour12: false });
}

function toDocumentRecord(item: DocumentApiItem): DocumentRecord {
  const normalizedOriginalName = decodePossibleMojibake(item.originalName?.trim());

  return {
    id: item.id,
    filename: normalizedOriginalName || item.filename,
    fileType: normalizeFileType(item),
    sizeLabel: formatSizeLabel(item.size),
    status: item.status,
    createdAt: formatDateTime(item.createdAt),
  };
}

export async function getDocuments(): Promise<DocumentRecord[]> {
  const response = await http.get<DocumentApiItem[] | ApiResponseLike<DocumentApiItem[]>>(
    "/documents",
  );
  const payload = response.data;
  const listCandidate = Array.isArray(payload) ? payload : payload.data;
  if (!Array.isArray(listCandidate)) {
    return [];
  }
  return listCandidate.map((item) => toDocumentRecord(item));
}

export async function uploadDocument(file: File): Promise<DocumentRecord> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await http.post<DocumentApiItem>("/documents/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return toDocumentRecord(response.data);
}

export async function deleteDocument(documentId: string): Promise<void> {
  await http.delete(`/documents/${documentId}`);
}
