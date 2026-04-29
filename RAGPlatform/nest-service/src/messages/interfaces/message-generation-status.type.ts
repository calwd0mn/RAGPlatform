export const MESSAGE_GENERATION_STATUSES = [
  'streaming',
  'completed',
  'interrupted',
  'failed',
] as const;

export type MessageGenerationStatus =
  (typeof MESSAGE_GENERATION_STATUSES)[number];
