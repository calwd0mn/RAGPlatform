import { NotFoundException } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ConversationsService } from '../conversations/services/conversations.service';
import { MessageRoleEnum } from './interfaces/message-role.type';
import { Message } from './schemas/message.schema';
import { MessagesService } from './messages.service';

function createMessageDoc(input?: {
  id?: string;
  conversationId?: string;
  userId?: string;
  role?: MessageRoleEnum;
  content?: string;
  createdAt?: Date;
}): {
  id: string;
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  role: MessageRoleEnum;
  content: string;
  citations: [];
  trace?: undefined;
  createdAt: Date;
  updatedAt: Date;
} {
  const baseTime = input?.createdAt ?? new Date('2026-04-15T12:00:00.000Z');
  return {
    id: input?.id ?? '507f1f77bcf86cd799439021',
    conversationId: new Types.ObjectId(input?.conversationId ?? '507f1f77bcf86cd799439011'),
    userId: new Types.ObjectId(input?.userId ?? '507f191e810c19729de860ea'),
    role: input?.role ?? MessageRoleEnum.User,
    content: input?.content ?? 'hello',
    citations: [],
    trace: undefined,
    createdAt: baseTime,
    updatedAt: baseTime,
  };
}

function createExecQuery<T>(value: T): { exec: () => Promise<T> } {
  return {
    exec: async (): Promise<T> => value,
  };
}

describe('MessagesService', () => {
  let service: MessagesService;
  let modelMock: jest.Mock & {
    find: jest.Mock;
  };
  let conversationsServiceMock: {
    ensureOwnedConversation: jest.Mock;
    touchLastMessageAt: jest.Mock;
  };
  let connectionMock: {
    startSession: jest.Mock;
  };
  let sessionMock: {
    withTransaction: jest.Mock;
    endSession: jest.Mock;
  };

  beforeEach(async () => {
    const constructorMock = jest.fn(function mockModel(
      this: { save: jest.Mock },
      params: {
        conversationId: Types.ObjectId;
        userId: Types.ObjectId;
        role: MessageRoleEnum;
        content: string;
        citations: [];
      },
    ) {
      this.save = jest.fn(async () =>
        createMessageDoc({
          conversationId: params.conversationId.toString(),
          userId: params.userId.toString(),
          role: params.role,
          content: params.content,
        }),
      );
    });

    modelMock = Object.assign(constructorMock, {
      find: jest.fn(),
    });

    conversationsServiceMock = {
      ensureOwnedConversation: jest.fn(),
      touchLastMessageAt: jest.fn(),
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
        MessagesService,
        {
          provide: getModelToken(Message.name),
          useValue: modelMock,
        },
        {
          provide: ConversationsService,
          useValue: conversationsServiceMock,
        },
        {
          provide: getConnectionToken(),
          useValue: connectionMock,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  it('creates a message under owned conversation successfully', async () => {
    const result = await service.create('507f191e810c19729de860ea', {
      conversationId: '507f1f77bcf86cd799439011',
      role: MessageRoleEnum.User,
      content: '  hi there  ',
    });

    expect(conversationsServiceMock.ensureOwnedConversation).toHaveBeenCalledWith(
      '507f191e810c19729de860ea',
      '507f1f77bcf86cd799439011',
      sessionMock,
    );
    expect(result.content).toBe('hi there');
    expect(result.conversationId).toBe('507f1f77bcf86cd799439011');
  });

  it('updates conversation lastMessageAt after message creation', async () => {
    const result = await service.create('507f191e810c19729de860ea', {
      conversationId: '507f1f77bcf86cd799439011',
      role: MessageRoleEnum.Assistant,
      content: 'ack',
    });

    expect(conversationsServiceMock.touchLastMessageAt).toHaveBeenCalledWith(
      '507f191e810c19729de860ea',
      '507f1f77bcf86cd799439011',
      result.createdAt,
      sessionMock,
    );
    expect(sessionMock.withTransaction).toHaveBeenCalledTimes(1);
    expect(sessionMock.endSession).toHaveBeenCalledTimes(1);
  });

  it('returns conversation-style not found when creating in non-owned conversation', async () => {
    conversationsServiceMock.ensureOwnedConversation.mockRejectedValue(
      new NotFoundException('Conversation not found'),
    );

    await expect(
      service.create('507f191e810c19729de860ea', {
        conversationId: '507f1f77bcf86cd799439011',
        role: MessageRoleEnum.User,
        content: 'hello',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('propagates error when updating lastMessageAt fails in transaction', async () => {
    conversationsServiceMock.touchLastMessageAt.mockRejectedValue(
      new NotFoundException('Conversation not found'),
    );

    await expect(
      service.create('507f191e810c19729de860ea', {
        conversationId: '507f1f77bcf86cd799439011',
        role: MessageRoleEnum.User,
        content: 'hello',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(sessionMock.withTransaction).toHaveBeenCalledTimes(1);
    expect(sessionMock.endSession).toHaveBeenCalledTimes(1);
  });

  it('reads messages of owned conversation successfully', async () => {
    const docs = [
      createMessageDoc({ id: '507f1f77bcf86cd799439021', content: 'first' }),
      createMessageDoc({ id: '507f1f77bcf86cd799439022', content: 'second' }),
    ];
    const sortMock = jest.fn(() => createExecQuery(docs));
    modelMock.find.mockReturnValue({ sort: sortMock });

    const result = await service.findByConversation(
      '507f191e810c19729de860ea',
      '507f1f77bcf86cd799439011',
    );

    expect(result.map((item) => item.content)).toEqual(['first', 'second']);
  });

  it('returns conversation-style not found when reading non-owned conversation', async () => {
    conversationsServiceMock.ensureOwnedConversation.mockRejectedValue(
      new NotFoundException('Conversation not found'),
    );

    await expect(
      service.findByConversation('507f191e810c19729de860ea', '507f1f77bcf86cd799439011'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('queries messages sorted by createdAt asc', async () => {
    const sortMock = jest.fn(() => createExecQuery([]));
    modelMock.find.mockReturnValue({ sort: sortMock });

    await service.findByConversation('507f191e810c19729de860ea', '507f1f77bcf86cd799439011');

    expect(sortMock).toHaveBeenCalledWith({ createdAt: 1 });
  });
});
