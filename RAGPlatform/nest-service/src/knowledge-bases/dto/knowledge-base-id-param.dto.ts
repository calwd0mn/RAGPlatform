import { IsMongoId } from 'class-validator';

export class KnowledgeBaseIdParamDto {
  @IsMongoId()
  knowledgeBaseId!: string;
}
