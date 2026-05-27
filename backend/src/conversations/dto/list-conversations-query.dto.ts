import { IsMongoId } from 'class-validator';

export class ListConversationsQueryDto {
  @IsMongoId()
  knowledgeBaseId!: string;
}
