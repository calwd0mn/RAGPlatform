import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { KnowledgeBaseIdParamDto } from './dto/knowledge-base-id-param.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { KnowledgeBaseResponse } from './interfaces/knowledge-base-response.interface';
import { KnowledgeBasesService } from './knowledge-bases.service';

@UseGuards(JwtAuthGuard)
@Controller('knowledge-bases')
export class KnowledgeBasesController {
  constructor(private readonly knowledgeBasesService: KnowledgeBasesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser): Promise<KnowledgeBaseResponse[]> {
    return this.knowledgeBasesService.findAllByUser(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseResponse> {
    return this.knowledgeBasesService.create(user.id, dto);
  }

  @Patch(':knowledgeBaseId')
  update(
    @CurrentUser() user: AuthUser,
    @Param() params: KnowledgeBaseIdParamDto,
    @Body() dto: UpdateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseResponse> {
    return this.knowledgeBasesService.update(user.id, params.knowledgeBaseId, dto);
  }

  @Delete(':knowledgeBaseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param() params: KnowledgeBaseIdParamDto,
  ): Promise<void> {
    return this.knowledgeBasesService.remove(user.id, params.knowledgeBaseId);
  }
}
