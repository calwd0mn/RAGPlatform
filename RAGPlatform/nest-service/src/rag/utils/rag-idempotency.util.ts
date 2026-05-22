import { MessageGenerationStatus } from '../../messages/interfaces/message-generation-status.type';

export const STALE_STREAMING_REQUEST_MS = 2 * 60 * 1000;

export type IdempotentAssistantMessageAction =
  | 'return-existing'
  | 'retry-generation'
  | 'reject-active-stream';

export interface RecentHistoryRequestIdFilter {
  requestId?: { $ne: string };
}

export function buildRecentHistoryRequestIdFilter(
  excludeRequestId?: string,
): RecentHistoryRequestIdFilter {
  if (!excludeRequestId) {
    return {};
  }

  return { requestId: { $ne: excludeRequestId } };
}

export function resolveIdempotentAssistantMessageAction(input: {
  status: MessageGenerationStatus;
  updatedAt: Date;
  now: Date;
  staleAfterMs: number;
}): IdempotentAssistantMessageAction {
  if (input.status === 'completed') {
    return 'return-existing';
  }

  if (input.status === 'failed' || input.status === 'interrupted') {
    return 'retry-generation';
  }

  const isStale =
    input.now.getTime() - input.updatedAt.getTime() >= input.staleAfterMs;
  return isStale ? 'retry-generation' : 'reject-active-stream';
}
