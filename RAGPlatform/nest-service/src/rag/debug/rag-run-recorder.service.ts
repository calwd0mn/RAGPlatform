import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  RagRun,
  RagRunDocument,
  RagRetrievalSource,
  RagRunRetrievalHit,
  RagRunStatus,
  RagRunType,
} from '../../schemas/rag-run.schema';
import {
  ChunkStrategyDraft,
  PromptDraft,
} from '../../schemas/debug-experiment.schema';

interface RecordRunInput {
  userId: string;
  knowledgeBaseId: string;
  conversationId?: string;
  experimentId?: string;
  runType: RagRunType;
  query: string;
  promptVersion: string;
  topK?: number;
  retrievalProvider?: string;
  retrievalNamespace?: string;
  retrievalSource?: RagRetrievalSource;
  comparisonKey?: string;
  promptSnapshot?: PromptDraft;
  chunkStrategySnapshot?: ChunkStrategyDraft;
  retrievalHits: RagRunRetrievalHit[];
  latencyMs: number;
  status: RagRunStatus;
  errorCode?: string;
}

@Injectable()
export class RagRunRecorderService {
  constructor(
    @InjectModel(RagRun.name)
    private readonly ragRunModel: Model<RagRunDocument>,
  ) {}

  async record(input: RecordRunInput): Promise<void> {
    if (
      !Types.ObjectId.isValid(input.userId) ||
      !Types.ObjectId.isValid(input.knowledgeBaseId)
    ) {
      return;
    }

    const document = new this.ragRunModel({
      userId: new Types.ObjectId(input.userId),
      knowledgeBaseId: new Types.ObjectId(input.knowledgeBaseId),
      conversationId: this.toOptionalObjectId(input.conversationId),
      experimentId: this.toOptionalObjectId(input.experimentId),
      runType: input.runType,
      query: input.query,
      promptVersion: input.promptVersion,
      topK: input.topK,
      retrievalProvider: input.retrievalProvider,
      retrievalNamespace: input.retrievalNamespace,
      retrievalSource: input.retrievalSource,
      comparisonKey: input.comparisonKey,
      promptSnapshot: input.promptSnapshot,
      chunkStrategySnapshot: input.chunkStrategySnapshot,
      retrievalHits: input.retrievalHits,
      latencyMs: Math.max(0, Math.floor(input.latencyMs)),
      status: input.status,
      errorCode: input.errorCode,
    });

    try {
      await document.save();
    } catch {
      return;
    }
  }

  private toOptionalObjectId(value: string | undefined): Types.ObjectId | undefined {
    if (!value || !Types.ObjectId.isValid(value)) {
      return undefined;
    }
    return new Types.ObjectId(value);
  }
}
