import { IsMongoId } from 'class-validator';

export class DocumentIdParamDto {
  @IsMongoId()
  id!: string;
}
