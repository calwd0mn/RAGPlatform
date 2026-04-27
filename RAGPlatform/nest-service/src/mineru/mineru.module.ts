import { Module } from '@nestjs/common';

import { MineruConfigService } from './mineru.config';
import { MineruService } from './mineru.service';

@Module({
  providers: [MineruConfigService, MineruService],
  exports: [MineruConfigService, MineruService],
})
export class MineruModule {}
