import { IsMongoId } from 'class-validator';

export class UploadDocumentDto {
  @IsMongoId()
  knowledgeBaseId!: string;
}
