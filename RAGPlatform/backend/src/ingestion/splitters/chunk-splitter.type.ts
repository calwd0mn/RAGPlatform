export const CHUNK_SPLITTER_TYPES = ['recursive', 'markdown', 'token'] as const;

export type ChunkSplitterType = (typeof CHUNK_SPLITTER_TYPES)[number];
