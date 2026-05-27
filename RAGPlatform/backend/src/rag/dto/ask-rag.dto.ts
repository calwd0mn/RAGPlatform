import {
  IsInt,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const ASK_MODES = ['rag', 'chat'] as const;

export type AskMode = (typeof ASK_MODES)[number];

export class AskRagDto {
  @IsMongoId()
  conversationId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Matches(/\S/, { message: 'query must not be empty' })
  query!: string;

  @IsOptional()
  @IsIn(ASK_MODES)
  mode?: AskMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;

  @IsOptional()
  @IsUUID()
  requestId?: string;
}
