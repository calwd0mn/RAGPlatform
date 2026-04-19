import { NotFoundException } from '@nestjs/common';

export function assertDebugAccess(debugTokenHeader?: string): void {
  const expectedToken = (process.env.RAG_DEBUG_ACCESS_TOKEN ?? '').trim();
  if (expectedToken.length === 0) {
    return;
  }

  const providedToken = (debugTokenHeader ?? '').trim();
  if (providedToken !== expectedToken) {
    throw new NotFoundException('Not Found');
  }
}
