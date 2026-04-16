import { Embeddings } from '@langchain/core/embeddings';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { fakeModel } from '@langchain/core/testing';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ConversationsService } from '../conversations/services/conversations.service';
import { IngestionEmbeddingsFactory } from '../ingestion/embeddings/embeddings.factory';
import { MessageRoleEnum } from '../messages/interfaces/message-role.type';
import { Message } from '../messages/schemas/message.schema';
import { RagContextBuilder } from './builders/rag-context.builder';
import { RagChatModelFactory } from './factories/rag-chat-model.factory';
import { RetrievedChunk } from './interfaces/retrieved-chunk.interface';
import { ChunkToCitationMapper } from './mappers/chunk-to-citation.mapper';
import { MessageHistoryMapper } from './mappers/message-history.mapper';
import { RagRetrievalService } from './retrievers/rag-retrieval.service';
import { RagService } from './rag.service';

class StaticEmbeddings extends Embeddings {
  constructor(private readonly value: number[]) {
    super({});
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return documents.map((): number[] => this.value);
  }

  async embedQuery(_document: string): Promise<number[]> {
    return this.value;
  }
}

class FailingEmbeddings extends Embeddings {
  constructor() {
    super({});
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return documents.map((): number[] => []);
  }

  async embedQuery(_document: string): Promise<number[]> {
    throw new Error('embedding failed');
  }
}

interface TestMessageDoc {
  id: string;
  userId: Types.ObjectId;
  conversationId: Types.ObjectId;
  role: MessageRoleEnum;
  content: string;
  citations: Array<{
    documentId?: string;
    chunkId?: string;
    documentName?: string;
    content?: string;
    score?: number;
    page?: number;
  }>;
  trace?: {
    query?: string;
    rewrittenQuery?: string;
    topK?: number;
    retrievedCount?: number;
    model?: string;
    latencyMs?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

function createMessageDocument(input: {
  id: string;
  userId: string;
  conversationId: string;
  role: MessageRoleEnum;
  content: string;
  citations?: TestMessageDoc['citations'];
  trace?: TestMessageDoc['trace'];
  createdAt?: Date;
}): TestMessageDoc {
  const createdAt = input.createdAt ?? new Date('2026-04-16T13:00:00.000Z');
  return {
    id: input.id,
    userId: new Types.ObjectId(input.userId),
    conversationId: new Types.ObjectId(input.conversationId),
    role: input.role,
    content: input.content,
    citations: input.citations ?? [],
    trace: input.trace,
    createdAt,
    updatedAt: createdAt,
  };
}

function createFindQueryChain(messages: TestMessageDoc[]): { sort: jest.Mock } {
  const exec = jest.fn(async () => messages);
  const limit = jest.fn(() => ({ exec }));
  const sort = jest.fn(() => ({ limit }));
  return { sort };
}

describe('RagService', () => {
  let service: RagService;
  let messageModelMock: jest.Mock & {
    find: jest.Mock;
  };
  let conversationsServiceMock: {
    ensureOwnedConversation: jest.Mock;
    touchLastMessageAt: jest.Mock;
  };
  let embeddingsFactoryMock: {
    createEmbeddings: jest.Mock;
  };
  let retrievalServiceMock: {
    retrieveTopKByUserWithProvider: jest.Mock;
  };
  let ragContextBuilderMock: {
    build: jest.Mock;
  };
  let messageHistoryMapperMock: {
    toLangchainMessages: jest.Mock;
  };
  let chunkToCitationMapperMock: {
    map: jest.Mock;
  };
  let ragChatModelFactoryMock: {
    create: jest.Mock;
    getModelLabel: jest.Mock;
  };
  let connectionMock: {
    startSession: jest.Mock;
  };
  let sessionMock: {
    withTransaction: jest.Mock;
    endSession: jest.Mock;
  };

  beforeEach(async () => {
    let messageIndex = 0;
    const constructorMock = jest.fn(function mockMessageModel(
      this: { save: jest.Mock },
      params: {
        userId: Types.ObjectId;
        conversationId: Types.ObjectId;
        role: MessageRoleEnum;
        content: string;
        citations: TestMessageDoc['citations'];
        trace?: TestMessageDoc['trace'];
      },
    ) {
      this.save = jest.fn(async () => {
        messageIndex += 1;
        return createMessageDocument({
          id: `507f1f77bcf86cd79943902${messageIndex}`,
          userId: params.userId.toString(),
          conversationId: params.conversationId.toString(),
          role: params.role,
          content: params.content,
          citations: params.citations,
          trace: params.trace,
          createdAt: new Date(`2026-04-16T13:00:0${messageIndex}.000Z`),
        });
      });
    });

    messageModelMock = Object.assign(constructorMock, {
      find: jest.fn(),
    });

    conversationsServiceMock = {
      ensureOwnedConversation: jest.fn(),
      touchLastMessageAt: jest.fn(),
    };

    embeddingsFactoryMock = {
      createEmbeddings: jest.fn(() => new StaticEmbeddings([1, 0, 0])),
    };

    retrievalServiceMock = {
      retrieveTopKByUserWithProvider: jest.fn(),
    };

    ragContextBuilderMock = {
      build: jest.fn(() => 'context'),
    };

    messageHistoryMapperMock = {
      toLangchainMessages: jest.fn(() => [new HumanMessage('history')]),
    };

    chunkToCitationMapperMock = {
      map: jest.fn((chunk: RetrievedChunk) => ({
        documentId: chunk.documentId,
        chunkId: chunk.chunkId,
        documentName: chunk.metadata.originalName,
        content: chunk.content,
        score: chunk.score,
        page: chunk.metadata.page,
      })),
    };

    ragChatModelFactoryMock = {
      create: jest.fn(async (preparedAnswer: string) =>
        fakeModel().respond(new AIMessage(preparedAnswer)),
      ),
      getModelLabel: jest.fn(() => 'fake-rag-model'),
    };

    sessionMock = {
      withTransaction: jest.fn(async (runInTransaction: () => Promise<void>) =>
        runInTransaction(),
      ),
      endSession: jest.fn(async () => undefined),
    };

    connectionMock = {
      startSession: jest.fn(async () => sessionMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagService,
        {
          provide: getModelToken(Message.name),
          useValue: messageModelMock,
        },
        {
          provide: ConversationsService,
          useValue: conversationsServiceMock,
        },
        {
          provide: IngestionEmbeddingsFactory,
          useValue: embeddingsFactoryMock,
        },
        {
          provide: RagRetrievalService,
          useValue: retrievalServiceMock,
        },
        {
          provide: RagContextBuilder,
          useValue: ragContextBuilderMock,
        },
        {
          provide: MessageHistoryMapper,
          useValue: messageHistoryMapperMock,
        },
        {
          provide: ChunkToCitationMapper,
          useValue: chunkToCitationMapperMock,
        },
        {
          provide: RagChatModelFactory,
          useValue: ragChatModelFactoryMock,
        },
        {
          provide: getConnectionToken(),
          useValue: connectionMock,
        },
      ],
    }).compile();

    service = module.get<RagService>(RagService);
  });

  it('creates user/assistant messages and returns rag response', async () => {
    const historyDocs = [
      createMessageDocument({
        id: '507f1f77bcf86cd799439031',
        userId: '507f191e810c19729de860ea',
        conversationId: '507f1f77bcf86cd799439011',
        role: MessageRoleEnum.User,
        content: 'old question',
      }),
    ];
    messageModelMock.find.mockReturnValue(createFindQueryChain(historyDocs));
    retrievalServiceMock.retrieveTopKByUserWithProvider.mockResolvedValue({
      chunks: [
        {
          chunkId: '507f1f77bcf86cd799439041',
          documentId: '507f1f77bcf86cd799439051',
          content: 'chunk content',
          score: 0.91,
          metadata: {
            page: 3,
            originalName: 'manual.pdf',
          },
        },
      ],
      provider: 'local',
    });

    const result = await service.ask('507f191e810c19729de860ea', {
      conversationId: '507f1f77bcf86cd799439011',
      query: '  什么是RAG?  ',
      topK: 4,
    });

    expect(result.answer.length).toBeGreaterThan(0);
    expect(result.citations).toHaveLength(1);
    expect(result.trace.retrievedCount).toBe(1);
    expect(result.trace.topK).toBe(4);
    expect(result.trace.retrievalProvider).toBe('local');
    expect(conversationsServiceMock.touchLastMessageAt).toHaveBeenCalledTimes(2);
    expect(messageModelMock).toHaveBeenCalledTimes(2);

    const assistantPayload = messageModelMock.mock.calls[1][0] as {
      citations: Array<{ chunkId?: string }>;
      trace?: { retrievedCount?: number };
    };
    expect(assistantPayload.citations[0].chunkId).toBe('507f1f77bcf86cd799439041');
    expect(assistantPayload.trace?.retrievedCount).toBe(1);
  });

  it('returns not found on non-owned conversation', async () => {
    conversationsServiceMock.ensureOwnedConversation.mockRejectedValue(
      new NotFoundException('Conversation not found'),
    );

    await expect(
      service.ask('507f191e810c19729de860ea', {
        conversationId: '507f1f77bcf86cd799439011',
        query: 'hello',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(messageModelMock).not.toHaveBeenCalled();
  });

  it('returns valid response when retrieval is empty', async () => {
    messageModelMock.find.mockReturnValue(createFindQueryChain([]));
    retrievalServiceMock.retrieveTopKByUserWithProvider.mockResolvedValue({
      chunks: [],
      provider: 'local',
    });

    const result = await service.ask('507f191e810c19729de860ea', {
      conversationId: '507f1f77bcf86cd799439011',
      query: '无匹配内容',
    });

    expect(result.citations).toHaveLength(0);
    expect(result.answer).toBe('根据当前已检索到的信息无法确定。');
    expect(result.trace.retrievedCount).toBe(0);
  });

  it('handles embedding failure with internal server error', async () => {
    messageModelMock.find.mockReturnValue(createFindQueryChain([]));
    embeddingsFactoryMock.createEmbeddings.mockReturnValue(new FailingEmbeddings());

    await expect(
      service.ask('507f191e810c19729de860ea', {
        conversationId: '507f1f77bcf86cd799439011',
        query: 'hello',
      }),
    ).rejects.toThrow(InternalServerErrorException);

    expect(messageModelMock).toHaveBeenCalledTimes(1);
    expect(conversationsServiceMock.touchLastMessageAt).toHaveBeenCalledTimes(1);
  });

  it('handles model failure with internal server error', async () => {
    messageModelMock.find.mockReturnValue(createFindQueryChain([]));
    retrievalServiceMock.retrieveTopKByUserWithProvider.mockResolvedValue({
      chunks: [],
      provider: 'local',
    });
    ragChatModelFactoryMock.create.mockRejectedValue(new Error('model failed'));

    await expect(
      service.ask('507f191e810c19729de860ea', {
        conversationId: '507f1f77bcf86cd799439011',
        query: 'hello',
      }),
    ).rejects.toThrow(InternalServerErrorException);

    expect(messageModelMock).toHaveBeenCalledTimes(1);
    expect(conversationsServiceMock.touchLastMessageAt).toHaveBeenCalledTimes(1);
  });

  it('keeps retrieval explicit error message from retrieval layer', async () => {
    messageModelMock.find.mockReturnValue(createFindQueryChain([]));
    retrievalServiceMock.retrieveTopKByUserWithProvider.mockRejectedValue(
      new InternalServerErrorException('Atlas retrieval is unavailable: atlas down'),
    );

    await expect(
      service.ask('507f191e810c19729de860ea', {
        conversationId: '507f1f77bcf86cd799439011',
        query: 'hello',
      }),
    ).rejects.toThrow('Atlas retrieval is unavailable: atlas down');
  });
});
