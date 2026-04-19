import { IsMongoId } from 'class-validator';

export class DebugExperimentIdParamDto {
  @IsMongoId()
  experimentId!: string;
}
