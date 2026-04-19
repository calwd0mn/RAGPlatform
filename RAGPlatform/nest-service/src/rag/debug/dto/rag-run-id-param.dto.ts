import { IsMongoId } from 'class-validator';

export class RagRunIdParamDto {
  @IsMongoId()
  runId!: string;
}
