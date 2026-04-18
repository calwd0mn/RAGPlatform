import { IsMongoId } from 'class-validator';

export class GetChunkContextParamDto {
  @IsMongoId()
  chunkId!: string;
}

