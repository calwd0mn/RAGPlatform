import { readFile } from 'fs/promises';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ChunkStrategyService } from '../src/ingestion/chunk-strategy/chunk-strategy.service';
import { RunChunkStrategyTestDto } from '../src/ingestion/chunk-strategy/dto/run-chunk-strategy-test.dto';

interface ScriptArgs {
  userId: string;
  payloadFile?: string;
  payloadJson?: string;
}

function parseArgs(argv: string[]): ScriptArgs {
  const args: ScriptArgs = {
    userId: '',
  };

  argv.forEach((item): void => {
    if (item.startsWith('--userId=')) {
      args.userId = item.slice('--userId='.length).trim();
      return;
    }

    if (item.startsWith('--payloadFile=')) {
      args.payloadFile = item.slice('--payloadFile='.length).trim();
      return;
    }

    if (item.startsWith('--payload=')) {
      args.payloadJson = item.slice('--payload='.length).trim();
    }
  });

  if (args.userId.length === 0) {
    throw new Error('Missing required argument: --userId=<mongo-user-id>');
  }

  if (!args.payloadFile && !args.payloadJson) {
    throw new Error(
      'Missing payload input: use --payloadFile=<path> or --payload=<json>',
    );
  }

  return args;
}

async function readPayload(args: ScriptArgs): Promise<RunChunkStrategyTestDto> {
  if (args.payloadJson) {
    return JSON.parse(args.payloadJson) as RunChunkStrategyTestDto;
  }

  if (!args.payloadFile) {
    throw new Error('payload file is required');
  }

  const fileContent = await readFile(args.payloadFile, 'utf-8');
  return JSON.parse(fileContent) as RunChunkStrategyTestDto;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const payload = await readPayload(args);
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const service = app.get(ChunkStrategyService);
    const report = await service.runTest(args.userId, payload);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await app.close();
  }
}

main().catch((error: Error): void => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
