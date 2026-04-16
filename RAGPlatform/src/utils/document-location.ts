export interface DocumentLocationQuery {
  documentId?: string;
  page?: number;
  chunkId?: string;
}

function normalizeQueryValue(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parsePage(value: string | null): number | undefined {
  const normalized = normalizeQueryValue(value);
  if (!normalized) {
    return undefined;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return Math.floor(parsed);
}

export function readDocumentLocationQuery(params: URLSearchParams): DocumentLocationQuery {
  return {
    documentId: normalizeQueryValue(params.get("documentId")),
    page: parsePage(params.get("page")),
    chunkId: normalizeQueryValue(params.get("chunkId")),
  };
}

export function buildDocumentLocationQuery(params: DocumentLocationQuery): string {
  const query = new URLSearchParams();
  if (params.documentId) {
    query.set("documentId", params.documentId);
  }
  if (typeof params.page === "number" && params.page > 0) {
    query.set("page", String(Math.floor(params.page)));
  }
  if (params.chunkId) {
    query.set("chunkId", params.chunkId);
  }
  return query.toString();
}

