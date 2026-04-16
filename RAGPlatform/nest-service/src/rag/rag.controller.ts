import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { AskRagDto } from './dto/ask-rag.dto';
import { RagAnswer } from './interfaces/rag-answer.interface';
import { RagService } from './rag.service';

@UseGuards(JwtAuthGuard)
@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('ask')
  ask(@CurrentUser() user: AuthUser, @Body() dto: AskRagDto): Promise<RagAnswer> {
    return this.ragService.ask(user.id, dto);
  }
}