import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { AuthUser } from '../auth/interfaces/auth-user.interface';

describe('ConversationsController', () => {
  let controller: ConversationsController;
  let service: {
    create: jest.Mock;
    findAllByUser: jest.Mock;
    findOneByUser: jest.Mock;
    updateTitle: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAllByUser: jest.fn(),
      findOneByUser: jest.fn(),
      updateTitle: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [
        {
          provide: ConversationsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<ConversationsController>(ConversationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('forwards create to service with current user id', async () => {
    const user: AuthUser = { id: 'u1', username: 'tester', email: 'tester@example.com' };
    service.create.mockResolvedValue({
      id: 'c1',
      userId: 'u1',
      title: '新会话',
      lastMessageAt: new Date('2026-04-15T12:00:00.000Z'),
      createdAt: new Date('2026-04-15T12:00:00.000Z'),
      updatedAt: new Date('2026-04-15T12:00:00.000Z'),
    });

    await controller.create(user, {});

    expect(service.create).toHaveBeenCalledWith('u1', {});
  });

  it('forwards findAll to service with current user id', async () => {
    const user: AuthUser = { id: 'u1', username: 'tester', email: 'tester@example.com' };
    service.findAllByUser.mockResolvedValue([]);

    await controller.findAll(user);

    expect(service.findAllByUser).toHaveBeenCalledWith('u1');
  });

  it('forwards delete to service with route param id', async () => {
    const user: AuthUser = { id: 'u1', username: 'tester', email: 'tester@example.com' };
    service.remove.mockResolvedValue(undefined);

    await controller.remove(user, { id: 'c1' });

    expect(service.remove).toHaveBeenCalledWith('u1', 'c1');
  });
});
