import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Chunk, ChunkSchema } from '../ingestion/schemas/chunk.schema';
import { ChunksController } from './controllers/chunks.controller';
import { ChunksService } from './services/chunks.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Chunk.name, schema: ChunkSchema }])],
  controllers: [ChunksController],
  providers: [ChunksService],
  exports: [ChunksService],
})
export class ChunksModule {}

