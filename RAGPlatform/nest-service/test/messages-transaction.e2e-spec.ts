import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Connection } from 'mongoose';
import request from 'supertest';
import { ConversationsService } from '../src/conversations/services/conversations.service';

describe('Messages Transaction (e2e)', () => {
  let app: INestApplication;
  let connection: Connection;
  let conversationsService: ConversationsService;
  let supportsTransactions = false;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI =
      process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/rag-platform-e2e';
    const { AppModule } = await import('../src/app.module');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    connection = app.get<Connection>(getConnectionToken());
    conversationsService = app.get<ConversationsService>(ConversationsService);
    if (!connection.db) {
      throw new Error('Mongo connection is not ready');
    }
    const helloResult = await connection.db.admin().command({ hello: 1 });
    supportsTransactions = Boolean(helloResult.setName);
  });

  beforeEach(async () => {
    await connection.dropDatabase();
  });

  it('rolls back message creation when lastMessageAt update fails', async () => {
    if (!supportsTransactions) {
      return;
    }

    const suffix = Date.now().toString();
    const email = `txn-${suffix}@example.com`;
    const username = `txn_user_${suffix}`;
    const password = 'Passw0rd!123';

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, username, password })
      .expect(201);

    const token = registerResponse.body.accessToken as string;

    const conversationResponse = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'transaction check' })
      .expect(201);

    const conversationId = conversationResponse.body.id as string;

    const touchSpy = jest
      .spyOn(conversationsService, 'touchLastMessageAt')
      .mockRejectedValueOnce(new NotFoundException('Conversation not found'));

    await request(app.getHttpServer())
      .post('/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        conversationId,
        role: 'user',
        content: 'should rollback',
      })
      .expect(404);

    touchSpy.mockRestore();

    const listResponse = await request(app.getHttpServer())
      .get(`/messages/conversation/${conversationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(listResponse.body).toEqual([]);
  });

  afterAll(async () => {
    if (connection) {
      await connection.dropDatabase();
      await connection.close();
    }

    if (app) {
      await app.close();
    }
  });
});
