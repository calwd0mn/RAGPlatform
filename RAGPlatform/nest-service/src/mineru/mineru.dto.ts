export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

export type MineruParseMode = 'sync_file_parse';

export interface MineruParseResult {
  markdown: string;
  contentList: JsonValue;
  middleJson: JsonValue;
  mode: MineruParseMode;
  artifactDirectoryPath: string;
}

export interface MineruParseFileInput {
  absoluteFilePath: string;
  originalName: string;
  mimeType: string;
  documentId: string;
}
