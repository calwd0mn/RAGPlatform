import { IsInt, IsMongoId, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class AskRagDto {
  @IsMongoId()
  conversationId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Matches(/\S/, { message: 'query must not be empty' })
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;
}