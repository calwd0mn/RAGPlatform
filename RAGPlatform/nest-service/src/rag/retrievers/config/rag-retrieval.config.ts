import { InternalServerErrorException } from '@nestjs/common';

const DEFAULT_RETRIEVAL_PROVIDER = 'local';
const DEFAULT_TOP_K = 5;
const DEFAULT_VECTOR_INDEX_NAME = 'chunk_vector_index';
const DEFAULT_VECTOR_PATH = 'embedding';
const DEFAULT_VECTOR_CANDIDATE_LIMIT = 100;

export type RagRetrievalProviderType = 'atlas' | 'local';

export interface RagRetrievalConfig {
  provider: RagRetrievalProviderType;
  topKDefault: number;
  vectorIndexName: string;
  vectorPath: string;
  vectorCandidateLimit: number;
  allowLocalFallback: boolean;
  nodeEnv: string;
}

function parsePositiveInteger(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function readString(name: string, fallback: string): string {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }

  return raw.trim();
}

function resolveProvider(value: string): RagRetrievalProviderType {
  if (value === 'atlas' || value === 'local') {
    return value;
  }

  throw new InternalServerErrorException(
    `Unsupported RAG_RETRIEVAL_PROVIDER: ${value}`,
  );
}

export function getRagRetrievalConfig(): RagRetrievalConfig {
  const providerRaw = readString(
    'RAG_RETRIEVAL_PROVIDER',
    DEFAULT_RETRIEVAL_PROVIDER,
  ).toLowerCase();
  const provider = resolveProvider(providerRaw);
  const vectorIndexNameEnv = (process.env.RAG_VECTOR_INDEX_NAME ?? '').trim();
  const vectorPathEnv = (process.env.RAG_VECTOR_PATH ?? '').trim();

  const topKDefault =
    parsePositiveInteger(process.env.RAG_TOP_K_DEFAULT) ?? DEFAULT_TOP_K;
  const vectorCandidateLimit =
    parsePositiveInteger(process.env.RAG_VECTOR_CANDIDATE_LIMIT) ??
    DEFAULT_VECTOR_CANDIDATE_LIMIT;
  const vectorIndexName =
    vectorIndexNameEnv.length > 0
      ? vectorIndexNameEnv
      : DEFAULT_VECTOR_INDEX_NAME;
  const vectorPath =
    vectorPathEnv.length > 0 ? vectorPathEnv : DEFAULT_VECTOR_PATH;
  const nodeEnv = readString('NODE_ENV', '').toLowerCase();
  const allowLocalFallback = parseBoolean(
    process.env.RAG_RETRIEVAL_ALLOW_FALLBACK_TO_LOCAL,
  );

  if (provider === 'atlas') {
    if (vectorIndexNameEnv.length === 0) {
      throw new InternalServerErrorException(
        'RAG_VECTOR_INDEX_NAME is required when RAG_RETRIEVAL_PROVIDER=atlas',
      );
    }

    if (vectorPathEnv.length === 0) {
      throw new InternalServerErrorException(
        'RAG_VECTOR_PATH is required when RAG_RETRIEVAL_PROVIDER=atlas',
      );
    }
  }

  return {
    provider,
    topKDefault,
    vectorIndexName,
    vectorPath,
    vectorCandidateLimit,
    allowLocalFallback,
    nodeEnv,
  };
}
