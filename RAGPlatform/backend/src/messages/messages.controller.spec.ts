import { Test, TestingModule } from '@nestjs/testing';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { MessageRoleEnum } from './interfaces/message-role.type';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

describe('MessagesController', () => {
  let controller: MessagesController;
  let service: {
    create: jest.Mock;
    findByConversation: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findByConversation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        {
          provide: MessagesService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<MessagesController>(MessagesController);
  });

  it('forwards create to service with current user id', async () => {
    const user: AuthUser = { id: 'u1', username: 'tester', email: 'tester@example.com' };
    service.create.mockResolvedValue({});

    await controller.create(user, {
      conversationId: '507f1f77bcf86cd799439011',
      role: MessageRoleEnum.User,
      content: 'hello',
    });

    expect(service.create).toHaveBeenCalledWith('u1', {
      conversationId: '507f1f77bcf86cd799439011',
      role: MessageRoleEnum.User,
      content: 'hello',
    });
  });

  it('forwards conversation query to service with current user id', async () => {
    const user: AuthUser = { id: 'u1', username: 'tester', email: 'tester@example.com' };
    service.findByConversation.mockResolvedValue([]);

    await controller.findByConversation(user, {
      conversationId: '507f1f77bcf86cd799439011',
    });

    expect(service.findByConversation).toHaveBeenCalledWith('u1', '507f1f77bcf86cd799439011');
  });
});
