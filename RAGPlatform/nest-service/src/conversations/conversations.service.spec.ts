import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ConversationsService } from './conversations.service';
import { Conversation } from './schemas/conversation.schema';

function createConversationDoc(input?: {
  id?: string;
  userId?: string;
  title?: string;
  lastMessageAt?: Date;
}): {
  id: string;
  userId: Types.ObjectId;
  title: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
} {
  const baseTime = new Date('2026-04-15T12:00:00.000Z');
  return {
    id: input?.id ?? '507f1f77bcf86cd799439011',
    userId: new Types.ObjectId(input?.userId ?? '507f191e810c19729de860ea'),
    title: input?.title ?? '默认标题',
    lastMessageAt: input?.lastMessageAt ?? baseTime,
    createdAt: baseTime,
    updatedAt: baseTime,
  };
}

function createExecQuery<T>(value: T): {
  session: (_value: object | null) => { exec: () => Promise<T> };
  exec: () => Promise<T>;
} {
  const query = {
    session: (_value: object | null): { exec: () => Promise<T> } => query,
    exec: async (): Promise<T> => value,
  };
  return query;
}

describe('ConversationsService', () => {
  let service: ConversationsService;
  let modelMock: jest.Mock & {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    findOneAndDelete: jest.Mock;
  };

  beforeEach(async () => {
    const constructorMock = jest.fn(function mockModel(
      this: { save: jest.Mock },
      params: { userId: Types.ObjectId; title: string; lastMessageAt: Date },
    ) {
      this.save = jest.fn(async () =>
        createConversationDoc({
          userId: params.userId.toString(),
          title: params.title,
          lastMessageAt: params.lastMessageAt,
        }),
      );
    });

    modelMock = Object.assign(constructorMock, {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        {
          provide: getModelToken(Conversation.name),
          useValue: modelMock,
        },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
  });

  it('creates conversation with default title when title is empty', async () => {
    const result = await service.create('507f191e810c19729de860ea', { title: '   ' });

    expect(result.title).toBe('新会话');
    expect(result.userId).toBe('507f191e810c19729de860ea');
  });

  it('lists conversations sorted by lastMessageAt desc query', async () => {
    const docs = [
      createConversationDoc({ id: '507f1f77bcf86cd799439012', title: 'A' }),
      createConversationDoc({ id: '507f1f77bcf86cd799439013', title: 'B' }),
    ];
    const sortMock = jest.fn(() => createExecQuery(docs));
    modelMock.find.mockReturnValue({ sort: sortMock });

    const result = await service.findAllByUser('507f191e810c19729de860ea');

    expect(sortMock).toHaveBeenCalledWith({ lastMessageAt: -1 });
    expect(result.map((item) => item.id)).toEqual([
      '507f1f77bcf86cd799439012',
      '507f1f77bcf86cd799439013',
    ]);
  });

  it('returns 404 when finding conversation out of ownership', async () => {
    modelMock.findOne.mockReturnValue(createExecQuery(null));

    await expect(
      service.findOneByUser('507f191e810c19729de860ea', '507f1f77bcf86cd799439011'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 when updating conversation out of ownership', async () => {
    modelMock.findOneAndUpdate.mockReturnValue(createExecQuery(null));

    await expect(
      service.updateTitle('507f191e810c19729de860ea', '507f1f77bcf86cd799439011', {
        title: 'new title',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 when deleting conversation out of ownership', async () => {
    modelMock.findOneAndDelete.mockReturnValue(createExecQuery(null));

    await expect(
      service.remove('507f191e810c19729de860ea', '507f1f77bcf86cd799439011'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 400 when id is invalid', async () => {
    await expect(service.findAllByUser('invalid-id')).rejects.toBeInstanceOf(BadRequestException);
  });
});
