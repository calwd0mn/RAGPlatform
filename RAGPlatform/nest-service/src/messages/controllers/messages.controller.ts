import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { ConversationMessagesParamDto } from '../dto/conversation-messages-param.dto';
import { CreateMessageDto } from '../dto/create-message.dto';
import { MessageResponse } from '../interfaces/message-response.interface';
import { MessagesService } from '../services/messages.service';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMessageDto,
  ): Promise<MessageResponse> {
    return this.messagesService.create(user.id, dto);
  }

  @Get('conversation/:conversationId')
  findByConversation(
    @CurrentUser() user: AuthUser,
    @Param() params: ConversationMessagesParamDto,
  ): Promise<MessageResponse[]> {
    return this.messagesService.findByConversation(
      user.id,
      params.conversationId,
    );
  }
}
