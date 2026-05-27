import { ConflictException, Injectable } from '@nestjs/common';

@Injectable()
export class RagGenerationLockService {
  private readonly activeGenerationKeys = new Set<string>();

  acquire(input: { userId: string; conversationId: string }): void {
    const key = this.buildKey(input);
    if (this.activeGenerationKeys.has(key)) {
      throw new ConflictException('当前会话正在生成中，请稍后再试');
    }

    this.activeGenerationKeys.add(key);
  }

  release(input: { userId: string; conversationId: string }): void {
    this.activeGenerationKeys.delete(this.buildKey(input));
  }

  private buildKey(input: { userId: string; conversationId: string }): string {
    return `${input.userId}:${input.conversationId}`;
  }
}
