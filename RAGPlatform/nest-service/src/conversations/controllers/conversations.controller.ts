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
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { ConversationIdParamDto } from '../dto/conversation-id-param.dto';
import { CreateConversationDto } from '../dto/create-conversation.dto';
import { ListConversationsQueryDto } from '../dto/list-conversations-query.dto';
import { UpdateConversationDto } from '../dto/update-conversation.dto';
import { ConversationResponse } from '../interfaces/conversation-response.interface';
import { ConversationsService } from '../services/conversations.service';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateConversationDto,
  ): Promise<ConversationResponse> {
    return this.conversationsService.create(user.id, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: ListConversationsQueryDto,
  ): Promise<ConversationResponse[]> {
    return this.conversationsService.findAllByUser(user.id, query.knowledgeBaseId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param() params: ConversationIdParamDto,
  ): Promise<ConversationResponse> {
    return this.conversationsService.findOneByUser(user.id, params.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param() params: ConversationIdParamDto,
    @Body() dto: UpdateConversationDto,
  ): Promise<ConversationResponse> {
    return this.conversationsService.updateTitle(user.id, params.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param() params: ConversationIdParamDto): Promise<void> {
    return this.conversationsService.remove(user.id, params.id);
  }
}
