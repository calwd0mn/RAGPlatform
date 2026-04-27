import { Injectable } from '@nestjs/common';
import { join } from 'path';

export interface MineruConfig {
  baseUrl: string;
  timeoutMs: number;
  backend: 'pipeline';
  artifactRootPath: string;
}

const DEFAULT_MINERU_BASE_URL = 'http://127.0.0.1:8000';
const DEFAULT_MINERU_TIMEOUT_MS = 120000;

@Injectable()
export class MineruConfigService {
  getConfig(): MineruConfig {
    const baseUrl =
      process.env.MINERU_BASE_URL?.trim() || DEFAULT_MINERU_BASE_URL;
    const timeoutRaw = process.env.MINERU_TIMEOUT_MS?.trim();
    const parsedTimeout = timeoutRaw
      ? Number.parseInt(timeoutRaw, 10)
      : DEFAULT_MINERU_TIMEOUT_MS;
    const timeoutMs =
      Number.isFinite(parsedTimeout) && parsedTimeout > 0
        ? parsedTimeout
        : DEFAULT_MINERU_TIMEOUT_MS;
    const artifactRootPath =
      process.env.MINERU_ARTIFACT_DIR?.trim() ||
      join(process.cwd(), 'uploads', 'mineru-artifacts');

    return {
      baseUrl: baseUrl.replace(/\/$/, ''),
      timeoutMs,
      backend: 'pipeline',
      artifactRootPath,
    };
  }
}
