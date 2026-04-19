import { Embeddings } from '@langchain/core/embeddings';
import { HumanMessage } from '@langchain/core/messages';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ConversationsService } from '../../conversations/services/conversations.service';
import { IngestionEmbeddingsFactory } from '../../ingestion/embeddings/embeddings.factory';
import { MessageRoleEnum } from '../../messages/interfaces/message-role.type';
import { Message } from '../../messages/schemas/message.schema';
import { RagRun } from '../../schemas/rag-run.schema';
import { RagContextBuilder } from '../builders/rag-context.builder';
import { MessageHistoryMapper } from '../mappers/message-history.mapper';
import { PromptRenderer } from '../prompt/prompt-renderer';
import { PromptRegistry } from '../prompt/prompt-registry';
import { RagRetrievalService } from '../retrievers/rag-retrieval.service';
import { RagRunRecorderService } from './rag-run-recorder.service';
import { RagDebugService } from './rag-debug.service';

class StaticEmbeddings extends Embeddings {
  constructor(private readonly vector: number[]) {
    super({});
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return documents.map((): number[] => this.vector);
  }

  async embedQuery(_document: string): Promise<number[]> {
    return this.vector;
  }
}

interface TestMessageItem {
  role: MessageRoleEnum;
  content: string;
}

function createFindQueryChain(messages: TestMessageItem[]): { sort: jest.Mock } {
  const exec = jest.fn(async () => messages);
  const limit = jest.fn(() => ({ exec }));
  const sort = jest.fn(() => ({ limit }));
  return { sort };
}

describe('RagDebugService', () => {
  let originalNodeEnv: string | undefined;
  let service: RagDebugService;
  let messageModelMock: {
    find: jest.Mock;
  };
  let conversationsServiceMock: {
    ensureOwnedConversation: jest.Mock;
  };
  let embeddingsFactoryMock: {
    createEmbeddings: jest.Mock;
  };
  let ragRetrievalServiceMock: {
    retrieveTopKByUserWithProvider: jest.Mock;
  };
  let ragContextBuilderMock: {
    build: jest.Mock;
  };
  let messageHistoryMapperMock: {
    toLangchainMessages: jest.Mock;
  };
  let promptRegistryMock: {
    getCurrent: jest.Mock;
  };
  let promptRendererMock: {
    render: jest.Mock;
  };
  let ragRunRecorderMock: {
    record: jest.Mock;
  };

  beforeEach(async () => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    messageModelMock = {
      find: jest.fn(),
    };
    conversationsServiceMock = {
      ensureOwnedConversation: jest.fn(async () => undefined),
    };
    embeddingsFactoryMock = {
      createEmbeddings: jest.fn(() => new StaticEmbeddings([1, 0, 0])),
    };
    ragRetrievalServiceMock = {
      retrieveTopKByUserWithProvider: jest.fn(async () => ({
        chunks: [],
        provider: 'local',
      })),
    };
    ragContextBuilderMock = {
      build: jest.fn(() => 'context'),
    };
    messageHistoryMapperMock = {
      toLangchainMessages: jest.fn(() => [new HumanMessage('history')]),
    };
    promptRegistryMock = {
      getCurrent: jest.fn(() => ({
        id: 'rag-answer',
        version: 'v1',
        versionedId: 'rag-answer@v1',
        systemPrompt: 'system',
        contextTemplate: '检索上下文如下：\n{context}',
      })),
    };
    promptRendererMock = {
      render: jest.fn(async () => ({
        messages: [],
        promptText: '',
      })),
    };
    ragRunRecorderMock = {
      record: jest.fn(async () => undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagDebugService,
        {
          provide: getModelToken(Message.name),
          useValue: messageModelMock,
        },
        {
          provide: getModelToken(RagRun.name),
          useValue: {},
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
          useValue: ragRetrievalServiceMock,
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
          provide: PromptRegistry,
          useValue: promptRegistryMock,
        },
        {
          provide: PromptRenderer,
          useValue: promptRendererMock,
        },
        {
          provide: RagRunRecorderService,
          useValue: ragRunRecorderMock,
        },
      ],
    }).compile();

    service = module.get<RagDebugService>(RagDebugService);
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
      return;
    }

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('appends current query to prompt render history when conversationId is absent', async () => {
    await service.renderPrompt('507f191e810c19729de860ea', {
      query: 'new question',
      topK: 5,
    });

    expect(messageHistoryMapperMock.toLangchainMessages).toHaveBeenCalledWith([
      {
        role: MessageRoleEnum.User,
        content: 'new question',
      },
    ]);
  });

  it('does not duplicate query if latest history user message already matches', async () => {
    messageModelMock.find.mockReturnValue(
      createFindQueryChain([
        {
          role: MessageRoleEnum.User,
          content: 'same query',
        },
      ]),
    );

    await service.renderPrompt('507f191e810c19729de860ea', {
      query: 'same query',
      conversationId: new Types.ObjectId().toString(),
      topK: 5,
    });

    expect(messageHistoryMapperMock.toLangchainMessages).toHaveBeenCalledWith([
      {
        role: MessageRoleEnum.User,
        content: 'same query',
      },
    ]);
  });
});
