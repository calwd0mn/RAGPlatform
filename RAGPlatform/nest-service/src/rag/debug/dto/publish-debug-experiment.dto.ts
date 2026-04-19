import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PublishDebugExperimentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  strategyName?: string;
}
