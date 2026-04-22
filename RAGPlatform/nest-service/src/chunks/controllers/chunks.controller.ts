import {
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { assertDebugAccess } from '../../debug/assert-debug-access';
import { GetChunkContextParamDto } from '../dto/get-chunk-context-param.dto';
import { GetChunkContextQueryDto } from '../dto/get-chunk-context-query.dto';
import { GetChunksDebugQueryDto } from '../dto/get-chunks-debug-query.dto';
import { ChunkContextResponse } from '../interfaces/chunk-context-response.interface';
import { ChunksDebugResponse } from '../interfaces/chunks-debug-response.interface';
import { ChunksService } from '../services/chunks.service';

@UseGuards(JwtAuthGuard)
@Controller('chunks')
export class ChunksController {
  constructor(private readonly chunksService: ChunksService) {}

  @Get('debug')
  getDebugChunks(
    @CurrentUser() user: AuthUser,
    @Query() query: GetChunksDebugQueryDto,
    @Headers('x-debug-token') debugTokenHeader?: string,
  ): Promise<ChunksDebugResponse> {
    this.assertDebugEnabled();
    assertDebugAccess(debugTokenHeader);
    return this.chunksService.findDebugChunks({
      userId: user.id,
      knowledgeBaseId: query.knowledgeBaseId,
      experimentId: query.experimentId,
      strategyName: query.strategyName,
      documentId: query.documentId,
      page: query.page,
      keyword: query.keyword,
      query: query.query,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get(':chunkId/context')
  getContext(
    @CurrentUser() user: AuthUser,
    @Param() params: GetChunkContextParamDto,
    @Query() query: GetChunkContextQueryDto,
  ): Promise<ChunkContextResponse> {
    return this.chunksService.getChunkContext({
      userId: user.id,
      chunkId: params.chunkId,
      knowledgeBaseId: query.knowledgeBaseId,
      experimentId: query.experimentId,
      before: query.before,
      after: query.after,
    });
  }

  private assertDebugEnabled(): void {
    const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
    const flag = (process.env.RAG_DEBUG_ENABLED ?? '').trim().toLowerCase();
    const enabledByFlag = flag === 'true' || flag === '1' || flag === 'yes';
    const enabled =
      nodeEnv === 'development' || nodeEnv === 'test' || enabledByFlag;

    if (!enabled) {
      throw new NotFoundException('Not Found');
    }
  }
}
