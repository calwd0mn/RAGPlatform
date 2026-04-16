import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { promises as fsPromises } from 'fs';
import { join } from 'path';
import { Connection, Model, Types } from 'mongoose';
import request from 'supertest';
import { Conversation, ConversationDocument } from '../src/conversations/schemas/conversation.schema';
import { DocumentStatusEnum } from '../src/documents/interfaces/document-status.type';
import { Document, DocumentDocument } from '../src/documents/schemas/document.schema';
import { MessageRoleEnum } from '../src/messages/interfaces/message-role.type';
import { MessageTrace } from '../src/messages/interfaces/message-trace.interface';
import { Message, MessageDocument } from '../src/messages/schemas/message.schema';
import { RagCitation } from '../src/rag/interfaces/rag-citation.interface';
import { RagTrace } from '../src/rag/interfaces/rag-trace.interface';

interface AuthResponseBody {
  accessToken: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
}

interface ConversationResponseBody {
  id: string;
  userId: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

interface DocumentResponseBody {
  id: string;
  status: DocumentStatusEnum;
}

interface IngestionResponseBody {
  documentId: string;
  finalStatus: DocumentStatusEnum;
  chunkCount: number;
  message: string;
}

interface RagAskResponseBody {
  answer: string;
  citations: RagCitation[];
  trace: RagTrace;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
}

describe('Rag Ask (e2e)', () => {
  let app: INestApplication;
  let connection: Connection;
  let conversationModel: Model<ConversationDocument>;
  let documentModel: Model<DocumentDocument>;
  let messageModel: Model<MessageDocument>;
  let documentsUploadDir: string;
  let originalNodeEnv: string | undefined;
  let originalMongoUri: string | undefined;
  let originalDocumentsUploadDir: string | undefined;
  let originalIngestionEmbeddingsProvider: string | undefined;
  let originalRagRetrievalProvider: string | undefined;
  let originalRagChatProvider: string | undefined;

  beforeAll(async () => {
    originalNodeEnv = process.env.NODE_ENV;
    originalMongoUri = process.env.MONGODB_URI;
    originalDocumentsUploadDir = process.env.DOCUMENTS_UPLOAD_DIR;
    originalIngestionEmbeddingsProvider = process.env.INGESTION_EMBEDDINGS_PROVIDER;
    originalRagRetrievalProvider = process.env.RAG_RETRIEVAL_PROVIDER;
    originalRagChatProvider = process.env.RAG_CHAT_PROVIDER;

    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI =
      process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/rag-platform-rag-ask-e2e';
    process.env.DOCUMENTS_UPLOAD_DIR =
      process.env.DOCUMENTS_UPLOAD_DIR ?? join(process.cwd(), 'uploads', 'rag-ask-e2e');
    process.env.INGESTION_EMBEDDINGS_PROVIDER = 'deterministic';
    process.env.RAG_RETRIEVAL_PROVIDER = 'local';
    process.env.RAG_CHAT_PROVIDER = 'fake';
    documentsUploadDir = process.env.DOCUMENTS_UPLOAD_DIR;

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
    conversationModel = app.get<Model<ConversationDocument>>(getModelToken(Conversation.name));
    documentModel = app.get<Model<DocumentDocument>>(getModelToken(Document.name));
    messageModel = app.get<Model<MessageDocument>>(getModelToken(Message.name));
  });

  beforeEach(async () => {
    await connection.dropDatabase();
    await fsPromises.rm(documentsUploadDir, { recursive: true, force: true });
    await fsPromises.mkdir(documentsUploadDir, { recursive: true });
  });

  async function registerAndGetToken(suffix: string): Promise<string> {
    const email = `rag-ask-${suffix}@example.com`;
    const username = `rag_ask_user_${suffix}`;
    const password = 'Passw0rd!123';

    const response = await request(app.getHttpServer()).post('/auth/register').send({
      email,
      username,
      password,
    });

    const body = response.body as AuthResponseBody;
    return body.accessToken;
  }

  async function createConversation(token: string, title: string): Promise<ConversationResponseBody> {
    const response = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({ title })
      .expect(201);

    return response.body as ConversationResponseBody;
  }

  async function uploadTextDocument(token: string, filename: string, content: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(content), {
        filename,
        contentType: 'text/plain',
      })
      .expect(201);

    const body = response.body as DocumentResponseBody;
    expect(body.status).toBe(DocumentStatusEnum.Uploaded);
    return body.id;
  }

  async function ingestDocument(token: string, documentId: string): Promise<IngestionResponseBody> {
    const response = await request(app.getHttpServer())
      .post(`/ingestion/${documentId}/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    return response.body as IngestionResponseBody;
  }

  function askRag(
    token: string,
    payload: { conversationId: string; query: string; topK?: number },
  ): request.Test {
    return request(app.getHttpServer())
      .post('/rag/ask')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
  }

  it('completes full rag ask flow and persists messages with citations and trace', async () => {
    const suffix = Date.now().toString();
    const token = await registerAndGetToken(`ok-${suffix}`);
    const conversation = await createConversation(token, 'rag main flow');
    const conversationLastMessageAtBefore = new Date(conversation.lastMessageAt).getTime();
    const documentId = await uploadTextDocument(
      token,
      `rag-main-${suffix}.txt`,
      'RAG platform supports ingestion and retrieval.\nRAG answers should include citations.\n',
    );

    const ingestionResult = await ingestDocument(token, documentId);
    expect(ingestionResult.documentId).toBe(documentId);
    expect(ingestionResult.finalStatus).toBe(DocumentStatusEnum.Ready);
    expect(ingestionResult.chunkCount).toBeGreaterThan(0);

    const askResponse = await askRag(token, {
      conversationId: conversation.id,
      query: '这个系统的回答需要返回什么？',
      topK: 3,
    }).expect(201);

    const body = askResponse.body as RagAskResponseBody;
    expect(body.answer).toEqual(expect.any(String));
    expect(body.answer.length).toBeGreaterThan(0);
    expect(Array.isArray(body.citations)).toBe(true);
    expect(body.trace).toBeDefined();
    expect(body.trace.query).toBe('这个系统的回答需要返回什么？');
    expect(body.trace.topK).toBe(3);
    expect(body.trace.retrievedCount).toBeGreaterThanOrEqual(0);
    expect(body.trace.retrievalProvider).toBe('local');
    expect(body.conversationId).toBe(conversation.id);
    expect(body.userMessageId).toEqual(expect.any(String));
    expect(body.assistantMessageId).toEqual(expect.any(String));

    const savedDocument = await documentModel.findById(documentId).exec();
    expect(savedDocument?.status).toBe(DocumentStatusEnum.Ready);

    const persistedConversation = await conversationModel.findById(conversation.id).exec();
    expect(persistedConversation).not.toBeNull();
    expect(persistedConversation!.lastMessageAt.getTime()).toBeGreaterThanOrEqual(
      conversationLastMessageAtBefore,
    );

    const persistedMessages = await messageModel
      .find({ conversationId: new Types.ObjectId(conversation.id) })
      .sort({ createdAt: 1 })
      .exec();

    expect(persistedMessages).toHaveLength(2);
    expect(persistedMessages[0].role).toBe(MessageRoleEnum.User);
    expect(persistedMessages[0].content).toBe('这个系统的回答需要返回什么？');
    expect(persistedMessages[1].role).toBe(MessageRoleEnum.Assistant);
    expect(persistedMessages[1].id).toBe(body.assistantMessageId);
    const persistedAssistantCitations = JSON.parse(
      JSON.stringify(persistedMessages[1].citations),
    ) as RagCitation[];
    expect(persistedAssistantCitations).toEqual(body.citations);
    expect(persistedMessages[1].trace).toMatchObject({
      query: body.trace.query,
      topK: body.trace.topK,
      retrievedCount: body.trace.retrievedCount,
      retrievalProvider: 'local',
    });
  });

  it('rejects rag ask on conversation not owned by current user', async () => {
    const suffix = Date.now().toString();
    const ownerToken = await registerAndGetToken(`owner-${suffix}`);
    const otherToken = await registerAndGetToken(`other-${suffix}`);
    const conversation = await createConversation(ownerToken, 'owner conversation');

    await askRag(otherToken, {
      conversationId: conversation.id,
      query: 'should be denied',
    }).expect(404);
  });

  it('returns valid answer structure when no related chunks are available', async () => {
    const suffix = Date.now().toString();
    const token = await registerAndGetToken(`empty-${suffix}`);
    const conversation = await createConversation(token, 'empty retrieval');

    const askResponse = await askRag(token, {
      conversationId: conversation.id,
      query: '没有文档时应该如何回答？',
    }).expect(201);

    const body = askResponse.body as RagAskResponseBody;
    expect(body.answer).toEqual(expect.any(String));
    expect(body.answer.length).toBeGreaterThan(0);
    expect(Array.isArray(body.citations)).toBe(true);
    expect(body.citations).toHaveLength(0);
    expect(body.trace.retrievedCount).toBe(0);
    expect(body.trace.retrievalProvider).toBe('local');

    const persistedMessages = await messageModel
      .find({ conversationId: new Types.ObjectId(conversation.id) })
      .sort({ createdAt: 1 })
      .exec();
    expect(persistedMessages).toHaveLength(2);
    expect(persistedMessages[1].role).toBe(MessageRoleEnum.Assistant);
    expect(persistedMessages[1].trace?.retrievedCount).toBe(0);
    expect(persistedMessages[1].citations).toEqual([]);
  });

  it('stores actual executed retrieval provider in response and assistant trace', async () => {
    const suffix = Date.now().toString();
    const token = await registerAndGetToken(`provider-${suffix}`);
    const conversation = await createConversation(token, 'provider trace check');

    const askResponse = await askRag(token, {
      conversationId: conversation.id,
      query: 'check provider trace',
      topK: 2,
    }).expect(201);

    const body = askResponse.body as RagAskResponseBody;
    expect(body.trace.retrievalProvider).toBe('local');

    const assistantMessage = await messageModel.findById(body.assistantMessageId).exec();
    const trace = assistantMessage?.trace as MessageTrace | undefined;
    expect(trace?.retrievalProvider).toBe('local');
  });

  afterAll(async () => {
    if (connection) {
      await connection.dropDatabase();
      await connection.close();
    }

    await fsPromises.rm(documentsUploadDir, { recursive: true, force: true });

    if (app) {
      await app.close();
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalMongoUri === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = originalMongoUri;
    }

    if (originalDocumentsUploadDir === undefined) {
      delete process.env.DOCUMENTS_UPLOAD_DIR;
    } else {
      process.env.DOCUMENTS_UPLOAD_DIR = originalDocumentsUploadDir;
    }

    if (originalIngestionEmbeddingsProvider === undefined) {
      delete process.env.INGESTION_EMBEDDINGS_PROVIDER;
    } else {
      process.env.INGESTION_EMBEDDINGS_PROVIDER = originalIngestionEmbeddingsProvider;
    }

    if (originalRagRetrievalProvider === undefined) {
      delete process.env.RAG_RETRIEVAL_PROVIDER;
    } else {
      process.env.RAG_RETRIEVAL_PROVIDER = originalRagRetrievalProvider;
    }

    if (originalRagChatProvider === undefined) {
      delete process.env.RAG_CHAT_PROVIDER;
    } else {
      process.env.RAG_CHAT_PROVIDER = originalRagChatProvider;
    }
  });
});
