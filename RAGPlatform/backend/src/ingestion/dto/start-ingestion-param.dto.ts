import { IsMongoId } from 'class-validator';

export class StartIngestionParamDto {
  @IsMongoId()
  documentId!: string;
}

