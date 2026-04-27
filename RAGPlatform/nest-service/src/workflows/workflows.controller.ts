import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Subject } from 'rxjs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { GetCurrentWorkflowQueryDto } from './dto/get-current-workflow-query.dto';
import { RunWorkflowDto } from './dto/run-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { WorkflowIdParamDto } from './dto/workflow-id-param.dto';
import { WorkflowResponse } from './interfaces/workflow-node.interface';
import {
  WorkflowExecutorService,
  WorkflowStreamEvent,
} from './services/workflow-executor.service';
import { WorkflowsService } from './services/workflows.service';

interface StreamErrorPayload {
  message: string;
}

@UseGuards(JwtAuthGuard)
@Controller('workflows')
export class WorkflowsController {
  constructor(
    private readonly workflowsService: WorkflowsService,
    private readonly workflowExecutorService: WorkflowExecutorService,
  ) {}

  @Get('current')
  findCurrent(
    @CurrentUser() user: AuthUser,
    @Query() query: GetCurrentWorkflowQueryDto,
  ): Promise<WorkflowResponse> {
    return this.workflowsService.findOrCreateCurrent(
      user.id,
      query.knowledgeBaseId,
    );
  }

  @Patch(':workflowId')
  update(
    @CurrentUser() user: AuthUser,
    @Param() params: WorkflowIdParamDto,
    @Body() dto: UpdateWorkflowDto,
  ): Promise<WorkflowResponse> {
    return this.workflowsService.update(user.id, params.workflowId, dto);
  }

  @Post(':workflowId/run/stream')
  async runStream(
    @CurrentUser() user: AuthUser,
    @Param() params: WorkflowIdParamDto,
    @Body() dto: RunWorkflowDto,
    @Res() response: Response,
  ): Promise<void> {
    const events = new Subject<WorkflowStreamEvent>();
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();

    const subscription = events.subscribe({
      next: (event): void => {
        if (response.writableEnded) {
          return;
        }
        this.writeEvent(response, event.type, event.data);
      },
      error: (error: Error): void => {
        if (!response.writableEnded) {
          this.writeEvent<StreamErrorPayload>(response, 'error', {
            message: this.resolveErrorMessage(error),
          });
          response.end();
        }
      },
      complete: (): void => {
        if (!response.writableEnded) {
          response.end();
        }
      },
    });

    try {
      await this.workflowExecutorService.execute({
        userId: user.id,
        workflowId: params.workflowId,
        inputs: dto.inputs,
        events,
      });
      events.complete();
    } catch (error) {
      events.error(error instanceof Error ? error : new Error('Workflow failed'));
    } finally {
      subscription.unsubscribe();
    }
  }

  private writeEvent<TPayload>(
    response: Response,
    event: string,
    payload: TPayload,
  ): void {
    response.write(`event: ${event}\n`);
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  private resolveErrorMessage(error: Error | HttpException): string {
    if (error instanceof HttpException) {
      const responsePayload = error.getResponse();
      if (
        typeof responsePayload === 'object' &&
        responsePayload !== null &&
        'message' in responsePayload
      ) {
        const messageValue = responsePayload.message;
        if (typeof messageValue === 'string') {
          return messageValue;
        }
        if (Array.isArray(messageValue)) {
          return messageValue
            .filter((item): item is string => typeof item === 'string')
            .join('；');
        }
      }
    }
    return error.message.trim() || 'Workflow execution failed';
  }
}
