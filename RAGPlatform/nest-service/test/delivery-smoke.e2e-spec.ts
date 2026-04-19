import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { promises as fsPromises } from 'fs';
import { join } from 'path';
import { Connection } from 'mongoose';
import request from 'supertest';
import { DocumentStatusEnum } from '../src/documents/interfaces/document-status.type';

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
}

interface DocumentResponseBody {
  id: string;
  status: DocumentStatusEnum;
}

interface IngestionResponseBody {
  documentId: string;
  finalStatus: DocumentStatusEnum;
  chunkCount: number;
}

interface RagAskResponseBody {
  answer: string;
  citations: Array<{ chunkId?: string }>;
  trace: {
    topK?: number;
    retrievedCount?: number;
  };
  conversationId: string;
}

interface PromptCurrentResponseBody {
  id: string;
  version: string;
  versionedId: string;
}

interface RagRunsResponseBody {
  items: Array<{
    runId: string;
    runType: 'ask' | 'debug-render' | 'debug-retrieve';
    status: 'success' | 'error';
  }>;
}

interface ChunksDebugResponseBody {
  total: number;
  items: Array<{
    chunkId: string;
    contentPreview: string;
  }>;
}

describe('Delivery Smoke (e2e)', () => {
  let app: INestApplication;
  let connection: Connection;
  let documentsUploadDir: string;
  let originalNodeEnv: string | undefined;
  let originalMongoUri: string | undefined;
  let originalDocumentsUploadDir: string | undefined;
  let originalIngestionEmbeddingsProvider: string | undefined;
  let originalRagRetrievalProvider: string | undefined;
  let originalRagChatProvider: string | undefined;
  let originalRagDebugEnabled: string | undefined;
  let originalRagDebugAccessToken: string | undefined;

  beforeAll(async () => {
    originalNodeEnv = process.env.NODE_ENV;
    originalMongoUri = process.env.MONGODB_URI;
    originalDocumentsUploadDir = process.env.DOCUMENTS_UPLOAD_DIR;
    originalIngestionEmbeddingsProvider = process.env.INGESTION_EMBEDDINGS_PROVIDER;
    originalRagRetrievalProvider = process.env.RAG_RETRIEVAL_PROVIDER;
    originalRagChatProvider = process.env.RAG_CHAT_PROVIDER;
    originalRagDebugEnabled = process.env.RAG_DEBUG_ENABLED;
    originalRagDebugAccessToken = process.env.RAG_DEBUG_ACCESS_TOKEN;

    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI =
      process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/rag-platform-delivery-smoke-e2e';
    process.env.DOCUMENTS_UPLOAD_DIR =
      process.env.DOCUMENTS_UPLOAD_DIR ?? join(process.cwd(), 'uploads', 'delivery-smoke-e2e');
    process.env.INGESTION_EMBEDDINGS_PROVIDER = 'deterministic';
    process.env.RAG_RETRIEVAL_PROVIDER = 'local';
    process.env.RAG_CHAT_PROVIDER = 'fake';
    process.env.RAG_DEBUG_ENABLED = 'true';
    process.env.RAG_DEBUG_ACCESS_TOKEN = 'delivery-debug-token';
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
  });

  beforeEach(async () => {
    await connection.dropDatabase();
    await fsPromises.rm(documentsUploadDir, { recursive: true, force: true });
    await fsPromises.mkdir(documentsUploadDir, { recursive: true });
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
    if (originalRagDebugEnabled === undefined) {
      delete process.env.RAG_DEBUG_ENABLED;
    } else {
      process.env.RAG_DEBUG_ENABLED = originalRagDebugEnabled;
    }
    if (originalRagDebugAccessToken === undefined) {
      delete process.env.RAG_DEBUG_ACCESS_TOKEN;
    } else {
      process.env.RAG_DEBUG_ACCESS_TOKEN = originalRagDebugAccessToken;
    }
  });

  async function registerAndGetToken(suffix: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/register').send({
      email: `delivery-${suffix}@example.com`,
      username: `delivery_${suffix}`,
      password: 'Passw0rd!123',
    });
    const body = response.body as AuthResponseBody;
    return body.accessToken;
  }

  async function createConversation(token: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'delivery smoke conversation' })
      .expect(201);
    const body = response.body as ConversationResponseBody;
    return body.id;
  }

  async function uploadDocument(token: string, suffix: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach(
        'file',
        Buffer.from('RAG delivery smoke text.\nNeed citations and trace.\n'),
        {
          filename: `delivery-${suffix}.txt`,
          contentType: 'text/plain',
        },
      )
      .expect(201);
    const body = response.body as DocumentResponseBody;
    expect(body.status).toBe(DocumentStatusEnum.Uploaded);
    return body.id;
  }

  it('covers the delivery-closure smoke flow', async () => {
    const suffix = Date.now().toString();
    const debugToken = process.env.RAG_DEBUG_ACCESS_TOKEN ?? '';
    const token = await registerAndGetToken(suffix);
    const conversationId = await createConversation(token);
    const documentId = await uploadDocument(token, suffix);

    const ingestionResponse = await request(app.getHttpServer())
      .post(`/ingestion/${documentId}/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const ingestionBody = ingestionResponse.body as IngestionResponseBody;
    expect(ingestionBody.finalStatus).toBe(DocumentStatusEnum.Ready);
    expect(ingestionBody.chunkCount).toBeGreaterThan(0);

    const askResponse = await request(app.getHttpServer())
      .post('/rag/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({
        conversationId,
        query: '请给出这份文档的要点',
        topK: 3,
      })
      .expect(201);
    const askBody = askResponse.body as RagAskResponseBody;
    expect(askBody.conversationId).toBe(conversationId);
    expect(askBody.answer.length).toBeGreaterThan(0);
    expect(Array.isArray(askBody.citations)).toBe(true);
    expect(askBody.trace.topK).toBe(3);
    expect(typeof askBody.trace.retrievedCount).toBe('number');

    await request(app.getHttpServer())
      .get('/rag/debug/prompt/current')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    const promptCurrentResponse = await request(app.getHttpServer())
      .get('/rag/debug/prompt/current')
      .set('Authorization', `Bearer ${token}`)
      .set('x-debug-token', debugToken)
      .expect(200);
    const promptCurrentBody = promptCurrentResponse.body as PromptCurrentResponseBody;
    expect(promptCurrentBody.id.length).toBeGreaterThan(0);
    expect(promptCurrentBody.version.length).toBeGreaterThan(0);
    expect(promptCurrentBody.versionedId.length).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .post('/rag/debug/retrieve')
      .set('Authorization', `Bearer ${token}`)
      .set('x-debug-token', debugToken)
      .send({
        query: 'delivery smoke retrieve',
        topK: 3,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/rag/debug/prompt/render')
      .set('Authorization', `Bearer ${token}`)
      .set('x-debug-token', debugToken)
      .send({
        query: 'delivery smoke render',
        topK: 3,
        conversationId,
      })
      .expect(201);

    const runsResponse = await request(app.getHttpServer())
      .get('/rag/debug/runs?limit=20&offset=0')
      .set('Authorization', `Bearer ${token}`)
      .set('x-debug-token', debugToken)
      .expect(200);
    const runsBody = runsResponse.body as RagRunsResponseBody;
    expect(runsBody.items.length).toBeGreaterThanOrEqual(2);

    const chunksDebugResponse = await request(app.getHttpServer())
      .get('/chunks/debug?limit=20&offset=0&query=delivery')
      .set('Authorization', `Bearer ${token}`)
      .set('x-debug-token', debugToken)
      .expect(200);
    const chunksDebugBody = chunksDebugResponse.body as ChunksDebugResponseBody;
    expect(chunksDebugBody.total).toBeGreaterThan(0);
    expect(chunksDebugBody.items.length).toBeGreaterThan(0);
    expect(chunksDebugBody.items[0].chunkId.length).toBeGreaterThan(0);
  });
});
