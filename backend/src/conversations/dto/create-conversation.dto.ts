import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateConversationDto {
  @IsMongoId()
  knowledgeBaseId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;
}
