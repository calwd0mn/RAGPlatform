import { Test, TestingModule } from '@nestjs/testing';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';

describe('RagController', () => {
  let controller: RagController;
  let ragServiceMock: {
    ask: jest.Mock;
  };

  beforeEach(async () => {
    ragServiceMock = {
      ask: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RagController],
      providers: [
        {
          provide: RagService,
          useValue: ragServiceMock,
        },
      ],
    }).compile();

    controller = module.get<RagController>(RagController);
  });

  it('delegates ask request to RagService', async () => {
    ragServiceMock.ask.mockResolvedValue({
      answer: 'ok',
      citations: [],
      trace: {
        query: 'hello',
        topK: 5,
        retrievedCount: 0,
        latencyMs: 1,
      },
      conversationId: '507f1f77bcf86cd799439011',
      userMessageId: '507f1f77bcf86cd799439021',
      assistantMessageId: '507f1f77bcf86cd799439022',
    });

    const result = await controller.ask(
      {
        id: '507f191e810c19729de860ea',
        username: 'tester',
        email: 'tester@example.com',
      },
      {
        conversationId: '507f1f77bcf86cd799439011',
        query: 'hello',
        topK: 5,
      },
    );

    expect(ragServiceMock.ask).toHaveBeenCalledWith('507f191e810c19729de860ea', {
      conversationId: '507f1f77bcf86cd799439011',
      query: 'hello',
      topK: 5,
    });
    expect(result.answer).toBe('ok');
  });
});