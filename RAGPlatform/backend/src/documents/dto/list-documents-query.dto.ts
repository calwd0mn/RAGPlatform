import { IsMongoId } from 'class-validator';

export class ListDocumentsQueryDto {
  @IsMongoId()
  knowledgeBaseId!: string;
}
