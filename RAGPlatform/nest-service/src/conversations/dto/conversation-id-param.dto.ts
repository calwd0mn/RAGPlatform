import { IsMongoId } from 'class-validator';

export class ConversationIdParamDto {
  @IsMongoId()
  id!: string;
}
