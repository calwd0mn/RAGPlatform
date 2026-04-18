import { Body, Controller, HttpException, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { AskRagDto } from './dto/ask-rag.dto';
import { RagAnswer } from './interfaces/rag-answer.interface';
import { RagService } from './rag.service';

interface StreamTokenPayload {
  text: string;
}

interface StreamErrorPayload {
  message: string;
}

@UseGuards(JwtAuthGuard)
@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('ask')
  ask(@CurrentUser() user: AuthUser, @Body() dto: AskRagDto): Promise<RagAnswer> {
    return this.ragService.ask(user.id, dto);
  }

  @Post('ask/stream')
  async askStream(
    @CurrentUser() user: AuthUser,
    @Body() dto: AskRagDto,
    @Res() response: Response,
  ): Promise<void> {
    const streamAbortController = new AbortController();
    const abortStreaming = (): void => {
      if (!streamAbortController.signal.aborted) {
        streamAbortController.abort();
      }
    };
    response.once('close', abortStreaming);

    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();

    try {
      const result = await this.ragService.askStream(user.id, dto, {
        signal: streamAbortController.signal,
        onToken: (token: string): void => {
          if (streamAbortController.signal.aborted || response.writableEnded) {
            return;
          }
          this.writeEvent<StreamTokenPayload>(response, 'token', { text: token });
        },
      });
      if (streamAbortController.signal.aborted || response.writableEnded) {
        return;
      }
      this.writeEvent<RagAnswer>(response, 'final', result);
    } catch (error) {
      if (streamAbortController.signal.aborted || response.writableEnded) {
        return;
      }
      this.writeEvent<StreamErrorPayload>(response, 'error', {
        message: this.resolveErrorMessage(error),
      });
    } finally {
      response.removeListener('close', abortStreaming);
      if (!response.writableEnded) {
        response.end();
      }
    }
  }

  private writeEvent<TPayload>(response: Response, event: string, payload: TPayload): void {
    response.write(`event: ${event}\n`);
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  private resolveErrorMessage(error: Error | HttpException): string {
    if (error instanceof HttpException) {
      const responsePayload = error.getResponse();
      if (typeof responsePayload === 'string' && responsePayload.trim().length > 0) {
        return responsePayload;
      }
      if (
        typeof responsePayload === 'object' &&
        responsePayload !== null &&
        'message' in responsePayload
      ) {
        const messageValue = responsePayload.message;
        if (typeof messageValue === 'string' && messageValue.trim().length > 0) {
          return messageValue;
        }
        if (Array.isArray(messageValue)) {
          const compacted = messageValue
            .filter((item): item is string => typeof item === 'string')
            .join('；')
            .trim();
          if (compacted.length > 0) {
            return compacted;
          }
        }
      }
      return error.message;
    }

    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    return '请求失败，请稍后重试。';
  }
}
