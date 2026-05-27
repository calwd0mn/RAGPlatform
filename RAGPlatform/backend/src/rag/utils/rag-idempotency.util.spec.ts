import { MessageGenerationStatus } from '../../messages/interfaces/message-generation-status.type';
import {
  buildRecentHistoryRequestIdFilter,
  resolveIdempotentAssistantMessageAction,
  STALE_STREAMING_REQUEST_MS,
} from './rag-idempotency.util';

function resolveAction(status: MessageGenerationStatus, updatedAt: Date): string {
  return resolveIdempotentAssistantMessageAction({
    status,
    updatedAt,
    now: new Date('2026-05-22T12:00:00.000Z'),
    staleAfterMs: STALE_STREAMING_REQUEST_MS,
  });
}

describe('resolveIdempotentAssistantMessageAction', () => {
  it('returns completed assistant messages without regenerating', () => {
    expect(resolveAction('completed', new Date('2026-05-22T11:59:59.000Z'))).toBe(
      'return-existing',
    );
  });

  it('allows failed and interrupted assistant messages to regenerate', () => {
    expect(resolveAction('failed', new Date('2026-05-22T11:59:59.000Z'))).toBe(
      'retry-generation',
    );
    expect(
      resolveAction('interrupted', new Date('2026-05-22T11:59:59.000Z')),
    ).toBe('retry-generation');
  });

  it('rejects an active streaming assistant message before it becomes stale', () => {
    expect(resolveAction('streaming', new Date('2026-05-22T11:59:30.000Z'))).toBe(
      'reject-active-stream',
    );
  });

  it('allows a stale streaming assistant message to regenerate', () => {
    expect(resolveAction('streaming', new Date('2026-05-22T11:57:59.000Z'))).toBe(
      'retry-generation',
    );
  });
});

describe('buildRecentHistoryRequestIdFilter', () => {
  it('does not add a requestId filter when there is no current request', () => {
    expect(buildRecentHistoryRequestIdFilter()).toEqual({});
  });

  it('excludes messages from the current idempotent request', () => {
    expect(buildRecentHistoryRequestIdFilter('request-1')).toEqual({
      requestId: { $ne: 'request-1' },
    });
  });
});
