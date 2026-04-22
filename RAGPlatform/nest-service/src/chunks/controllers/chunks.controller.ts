import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { GetChunkContextParamDto } from '../dto/get-chunk-context-param.dto';
import { GetChunkContextQueryDto } from '../dto/get-chunk-context-query.dto';
import { ChunkContextResponse } from '../interfaces/chunk-context-response.interface';
import { ChunksService } from '../services/chunks.service';

@UseGuards(JwtAuthGuard)
@Controller('chunks')
export class ChunksController {
  constructor(private readonly chunksService: ChunksService) {}

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
      before: query.before,
      after: query.after,
    });
  }
}
