import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { StartIngestionParamDto } from '../dto/start-ingestion-param.dto';
import { IngestionResult } from '../interfaces/ingestion-result.interface';
import { IngestionService } from '../services/ingestion.service';

@UseGuards(JwtAuthGuard)
@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post(':documentId/start')
  start(
    @CurrentUser() user: AuthUser,
    @Param() params: StartIngestionParamDto,
  ): Promise<IngestionResult> {
    return this.ingestionService.start(user.id, params.documentId);
  }
}

