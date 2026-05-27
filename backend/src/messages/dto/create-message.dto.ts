import {
  IsEnum,
  IsMongoId,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MessageRoleEnum } from '../interfaces/message-role.type';

export class CreateMessageDto {
  @IsMongoId()
  conversationId!: string;

  @IsEnum(MessageRoleEnum)
  role!: MessageRoleEnum;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  @Matches(/\S/, { message: 'content must not be empty' })
  content!: string;
}
