import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { assertDebugAccess } from '../../debug/assert-debug-access';
import { RunChunkStrategyTestDto } from '../../ingestion/chunk-strategy/dto/run-chunk-strategy-test.dto';
import { CreateDebugExperimentDto, UpdateDebugExperimentDto } from './dto/create-debug-experiment.dto';
import { DebugExperimentIdParamDto } from './dto/debug-experiment-id-param.dto';
import { GetDebugExperimentsQueryDto } from './dto/get-debug-experiments-query.dto';
import { GetRagRunsQueryDto } from './dto/get-rag-runs-query.dto';
import { PublishDebugExperimentDto } from './dto/publish-debug-experiment.dto';
import { RagRunIdParamDto } from './dto/rag-run-id-param.dto';
import { RenderRagPromptDto } from './dto/render-rag-prompt.dto';
import { RetrieveRagDebugDto } from './dto/retrieve-rag-debug.dto';
import { DebugExperimentsService } from './debug-experiments.service';
import { RagDebugService } from './rag-debug.service';

@UseGuards(JwtAuthGuard)
@Controller('rag/debug')
export class RagDebugController {
  constructor(
    private readonly ragDebugService: RagDebugService,
    private readonly debugExperimentsService: DebugExperimentsService,
  ) {}

  @Get('prompt/current')
  getCurrentPrompt(
    @Headers('x-debug-token') debugTokenHeader?: string,
  ): ReturnType<RagDebugService['getCurrentPrompt']> {
    assertDebugAccess(debugTokenHeader);
    return this.ragDebugService.getCurrentPrompt();
  }

  @Post('prompt/render')
  renderPrompt(
    @CurrentUser() user: AuthUser,
    @Body() dto: RenderRagPromptDto,
    @Headers('x-debug-token') debugTokenHeader?: string,
  ): ReturnType<RagDebugService['renderPrompt']> {
    assertDebugAccess(debugTokenHeader);
    return this.ragDebugService.renderPrompt(user.id, dto);
  }

  @Post('retrieve')
  retrieve(
    @CurrentUser() user: AuthUser,
    @Body() dto: RetrieveRagDebugDto,
    @Headers('x-debug-token') debugTokenHeader?: string,
  ): ReturnType<RagDebugService['debugRetrieve']> {
    assertDebugAccess(debugTokenHeader);
    return this.ragDebugService.debugRetrieve(user.id, dto);
  }

  @Post('chunk-strategy-test')
  runChunkStrategyTest(
    @CurrentUser() user: AuthUser,
    @Body() dto: RunChunkStrategyTestDto,
    @Headers('x-debug-token') debugTokenHeader?: string,
  ): ReturnType<RagDebugService['runChunkStrategyTest']> {
    assertDebugAccess(debugTokenHeader);
    return this.ragDebugService.runChunkStrategyTest(user.id, dto);
  }

  @Post('experiments')
  createExperiment(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDebugExperimentDto,
    @Headers('x-debug-token') debugTokenHeader?: string,
  ): ReturnType<DebugExperimentsService['createExperiment']> {
    assertDebugAccess(debugTokenHeader);
    return this.debugExperimentsService.createExperiment(user.id, dto);
  }

  @Patch('experiments/:experimentId')
  updateExperiment(
    @CurrentUser() user: AuthUser,
    @Param() params: DebugExperimentIdParamDto,
    @Body() dto: UpdateDebugExperimentDto,
    @Headers('x-debug-token') debugTokenHeader?: string,
  ): ReturnType<DebugExperimentsService['updateExperiment']> {
    assertDebugAccess(debugTokenHeader);
    return this.debugExperimentsService.updateExperiment(
      user.id,
      params.experimentId,
      dto,
    );
  }

  @Get('experiments')
  getExperiments(
    @CurrentUser() user: AuthUser,
    @Query() query: GetDebugExperimentsQueryDto,
    @Headers('x-debug-token') debugTokenHeader?: string,
  ): ReturnType<DebugExperimentsService['findExperiments']> {
    assertDebugAccess(debugTokenHeader);
    return this.debugExperimentsService.findExperiments(user.id, query);
  }

  @Get('experiments/:experimentId')
  getExperimentById(
    @CurrentUser() user: AuthUser,
    @Param() params: DebugExperimentIdParamDto,
    @Headers('x-debug-token') debugTokenHeader?: string,
  ): ReturnType<DebugExperimentsService['findExperimentById']> {
    assertDebugAccess(debugTokenHeader);
    return this.debugExperimentsService.findExperimentById(
      user.id,
      params.experimentId,
    );
  }

  @Post('experiments/:experimentId/run')
  runExperiment(
    @CurrentUser() user: AuthUser,
    @Param() params: DebugExperimentIdParamDto,
    @Headers('x-debug-token') debugTokenHeader?: string,
  ): ReturnType<DebugExperimentsService['runExperiment']> {
    assertDebugAccess(debugTokenHeader);
    return this.debugExperimentsService.runExperiment(user.id, params.experimentId);
  }

  @Post('experiments/:experimentId/publish')
  publishExperiment(
    @CurrentUser() user: AuthUser,
    @Param() params: DebugExperimentIdParamDto,
    @Body() dto: PublishDebugExperimentDto,
    @Headers('x-debug-token') debugTokenHeader?: string,
  ): ReturnType<DebugExperimentsService['publishExperiment']> {
    assertDebugAccess(debugTokenHeader);
    return this.debugExperimentsService.publishExperiment(
      user.id,
      params.experimentId,
      dto,
    );
  }

  @Get('runs')
  getRuns(
    @CurrentUser() user: AuthUser,
    @Query() query: GetRagRunsQueryDto,
    @Headers('x-debug-token') debugTokenHeader?: string,
  ): ReturnType<RagDebugService['findRuns']> {
    assertDebugAccess(debugTokenHeader);
    return this.ragDebugService.findRuns(user.id, query);
  }

  @Get('runs/:runId')
  getRunById(
    @CurrentUser() user: AuthUser,
    @Param() params: RagRunIdParamDto,
    @Headers('x-debug-token') debugTokenHeader?: string,
  ): ReturnType<RagDebugService['findRunById']> {
    assertDebugAccess(debugTokenHeader);
    return this.ragDebugService.findRunById(user.id, params.runId);
  }
}
