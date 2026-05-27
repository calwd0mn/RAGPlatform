import { Injectable, Logger } from '@nestjs/common';
import { promises as fsPromises } from 'fs';
import { join } from 'path';

import {
  JsonValue,
  MineruParseFileInput,
  MineruParseResult,
} from './mineru.dto';
import { MineruConfigService } from './mineru.config';

interface JsonObject {
  [key: string]: JsonValue;
}

export class MineruParseError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'MineruParseError';
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) {
    return true;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item));
  }

  if (isJsonObject(value)) {
    return Object.values(value).every((item) => isJsonValue(item));
  }

  return false;
}

function tryReadString(
  source: JsonObject,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const candidate = source[key];

    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return null;
}

function tryReadJsonValue(
  source: JsonObject,
  keys: readonly string[],
): JsonValue | null {
  for (const key of keys) {
    const candidate = source[key];

    if (candidate !== undefined && isJsonValue(candidate)) {
      return candidate;
    }
  }

  return null;
}

function tryReadFirstResultEntry(source: JsonObject): JsonObject | null {
  const results = source.results;

  if (!isJsonObject(results)) {
    return null;
  }

  for (const value of Object.values(results)) {
    if (isJsonObject(value)) {
      return value;
    }
  }

  return null;
}

function buildContentListFromMarkdown(markdown: string): JsonValue {
  return markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index): JsonValue => {
      const headingLevel = line.match(/^#+/)?.[0].length ?? 0;
      const text = headingLevel > 0 ? line.slice(headingLevel).trim() : line;

      return {
        id: `derived-${index + 1}`,
        type: headingLevel > 0 ? 'heading' : 'paragraph',
        text,
        level: headingLevel > 0 ? headingLevel : null,
      };
    });
}

function normalizeMineruPayload(
  payload: unknown,
): Omit<MineruParseResult, 'artifactDirectoryPath'> {
  if (!isJsonObject(payload)) {
    throw new MineruParseError(
      'MinerU returned an unsupported response.',
      false,
    );
  }

  const container = isJsonObject(payload.data)
    ? payload.data
    : isJsonObject(payload.result)
      ? payload.result
      : payload;
  const firstResultEntry =
    tryReadFirstResultEntry(payload) ?? tryReadFirstResultEntry(container);

  const markdown =
    (firstResultEntry
      ? tryReadString(firstResultEntry, ['markdown', 'md', 'md_content'])
      : null) ??
    tryReadString(container, ['markdown', 'md', 'md_content']) ??
    tryReadString(payload, ['markdown', 'md', 'md_content']);
  const contentList =
    (firstResultEntry
      ? tryReadJsonValue(firstResultEntry, ['content_list', 'contentList'])
      : null) ??
    tryReadJsonValue(container, ['content_list', 'contentList']) ??
    tryReadJsonValue(payload, ['content_list', 'contentList']);
  const middleJson =
    (firstResultEntry
      ? tryReadJsonValue(firstResultEntry, ['middle_json', 'middleJson'])
      : null) ??
    tryReadJsonValue(container, ['middle_json', 'middleJson']) ??
    tryReadJsonValue(payload, ['middle_json', 'middleJson']);

  if (!markdown) {
    throw new MineruParseError('MinerU response is missing markdown.', false);
  }

  return {
    markdown,
    contentList: contentList ?? buildContentListFromMarkdown(markdown),
    middleJson: middleJson ?? firstResultEntry ?? payload,
    mode: 'sync_file_parse',
  };
}

@Injectable()
export class MineruService {
  private readonly logger = new Logger(MineruService.name);

  constructor(private readonly mineruConfigService: MineruConfigService) {}

  async parseFile(input: MineruParseFileInput): Promise<MineruParseResult> {
    const config = this.mineruConfigService.getConfig();
    const url = `${config.baseUrl}/file_parse`;
    const fileBuffer = await fsPromises.readFile(input.absoluteFilePath);
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, config.timeoutMs);
    const formData = new FormData();

    formData.append(
      'files',
      new Blob([fileBuffer], { type: input.mimeType }),
      input.originalName,
    );
    formData.append('backend', config.backend);
    formData.append('parse_method', 'auto');
    formData.append('lang_list', 'ch');
    formData.append('return_md', 'true');
    formData.append('return_content_list', 'true');
    formData.append('return_middle_json', 'true');

    this.logger.log(
      `Calling MinerU /file_parse for document ${input.documentId}.`,
    );

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: timeoutController.signal,
      });
      const responseBody: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          isJsonObject(responseBody) &&
          typeof responseBody.detail === 'string' &&
          responseBody.detail.trim().length > 0
            ? responseBody.detail
            : `MinerU request failed with status ${response.status}.`;

        throw new MineruParseError(message, response.status >= 500);
      }

      const normalizedPayload = normalizeMineruPayload(responseBody);
      const artifactDirectoryPath = await this.saveArtifacts(
        input.documentId,
        normalizedPayload,
      );

      return {
        ...normalizedPayload,
        artifactDirectoryPath,
      };
    } catch (error) {
      if (error instanceof MineruParseError) {
        this.logger.error(`MinerU parse failed: ${error.message}`);
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const isTimeout = errorMessage.toLowerCase().includes('abort');
      const message = isTimeout
        ? `MinerU request timed out after ${config.timeoutMs}ms.`
        : `MinerU request failed: ${errorMessage}`;

      this.logger.error(message);
      throw new MineruParseError(message, true);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async saveArtifacts(
    documentId: string,
    result: Omit<MineruParseResult, 'artifactDirectoryPath'>,
  ): Promise<string> {
    const config = this.mineruConfigService.getConfig();
    const artifactDirectoryPath = join(config.artifactRootPath, documentId);

    await fsPromises.mkdir(artifactDirectoryPath, { recursive: true });
    await Promise.all([
      fsPromises.writeFile(
        join(artifactDirectoryPath, 'markdown.md'),
        result.markdown,
        { encoding: 'utf-8' },
      ),
      fsPromises.writeFile(
        join(artifactDirectoryPath, 'content-list.json'),
        JSON.stringify(result.contentList, null, 2),
        { encoding: 'utf-8' },
      ),
      fsPromises.writeFile(
        join(artifactDirectoryPath, 'middle-json.json'),
        JSON.stringify(result.middleJson, null, 2),
        { encoding: 'utf-8' },
      ),
    ]);

    return artifactDirectoryPath;
  }
}
