import { IsMongoId } from 'class-validator';

export class ConversationMessagesParamDto {
  @IsMongoId()
  conversationId!: string;
}
