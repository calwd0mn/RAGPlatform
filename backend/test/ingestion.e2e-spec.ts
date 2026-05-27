import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Embeddings } from '@langchain/core/embeddings';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { promises as fsPromises } from 'fs';
import { join } from 'path';
import { Connection, Model, Types } from 'mongoose';
import request from 'supertest';
import { DocumentStatusEnum } from '../src/documents/interfaces/document-status.type';
import {
  Document,
  DocumentDocument,
} from '../src/documents/schemas/document.schema';
import { IngestionEmbeddingsFactory } from '../src/ingestion/embeddings/embeddings.factory';
import { Chunk, ChunkDocument } from '../src/ingestion/schemas/chunk.schema';

class FailingEmbeddings extends Embeddings {
  constructor() {
    super({});
  }

  async embedDocuments(_documents: string[]): Promise<number[][]> {
    throw new Error('forced embedding failure');
  }

  async embedQuery(_document: string): Promise<number[]> {
    throw new Error('forced embedding failure');
  }
}

describe('Ingestion (e2e)', () => {
  let app: INestApplication;
  let connection: Connection;
  let documentModel: Model<DocumentDocument>;
  let chunkModel: Model<ChunkDocument>;
  let ingestionEmbeddingsFactory: IngestionEmbeddingsFactory;
  let documentsUploadDir: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI =
      process.env.MONGODB_URI ??
      'mongodb://127.0.0.1:27017/rag-platform-ingestion-e2e';
    process.env.DOCUMENTS_UPLOAD_DIR =
      process.env.DOCUMENTS_UPLOAD_DIR ??
      join(process.cwd(), 'uploads', 'ingestion-e2e');
    process.env.INGESTION_EMBEDDINGS_PROVIDER = 'deterministic';
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
    documentModel = app.get<Model<DocumentDocument>>(
      getModelToken(Document.name),
    );
    chunkModel = app.get<Model<ChunkDocument>>(getModelToken(Chunk.name));
    ingestionEmbeddingsFactory = app.get<IngestionEmbeddingsFactory>(
      IngestionEmbeddingsFactory,
    );
  });

  beforeEach(async () => {
    await connection.dropDatabase();
    await fsPromises.rm(documentsUploadDir, { recursive: true, force: true });
    await fsPromises.mkdir(documentsUploadDir, { recursive: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function registerAndGetToken(suffix: string): Promise<string> {
    const email = `ing-${suffix}@example.com`;
    const username = `ing_user_${suffix}`;
    const password = 'Passw0rd!123';

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        username,
        password,
      });

    return response.body.accessToken as string;
  }

  async function createKnowledgeBase(
    token: string,
    suffix: string,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/knowledge-bases')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `kb-${suffix}`,
      })
      .expect(201);

    return response.body.id as string;
  }

  async function uploadTextDocument(
    token: string,
    knowledgeBaseId: string,
    filename: string,
    content: string,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('knowledgeBaseId', knowledgeBaseId)
      .attach('file', Buffer.from(content), {
        filename,
        contentType: 'text/plain',
      })
      .expect(201);

    return response.body.id as string;
  }

  it('allows user to ingest own uploaded document and persists chunks', async () => {
    const token = await registerAndGetToken(`ok-${Date.now()}`);
    const knowledgeBaseId = await createKnowledgeBase(
      token,
      `ok-${Date.now()}`,
    );
    const documentId = await uploadTextDocument(
      token,
      knowledgeBaseId,
      'ing-success.txt',
      'Line1\nLine2\nLine3\nLine4\nLine5\nLine6\nLine7\nLine8\nLine9\nLine10',
    );

    const startResponse = await request(app.getHttpServer())
      .post(`/ingestion/${documentId}/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(startResponse.body.documentId).toBe(documentId);
    expect(startResponse.body.finalStatus).toBe(DocumentStatusEnum.Ready);
    expect(startResponse.body.chunkCount).toBeGreaterThan(0);

    const savedDocument = await documentModel.findById(documentId).exec();
    expect(savedDocument?.status).toBe(DocumentStatusEnum.Ready);

    const persistedChunks = await chunkModel
      .find({ documentId: new Types.ObjectId(documentId) })
      .exec();
    expect(persistedChunks.length).toBeGreaterThan(0);
  });

  it('rejects ingestion on another user document', async () => {
    const base = Date.now();
    const ownerToken = await registerAndGetToken(`owner-${base}`);
    const otherToken = await registerAndGetToken(`other-${base}`);
    const ownerKnowledgeBaseId = await createKnowledgeBase(
      ownerToken,
      `owner-${base}`,
    );
    const documentId = await uploadTextDocument(
      ownerToken,
      ownerKnowledgeBaseId,
      'owner.txt',
      'private content',
    );

    await request(app.getHttpServer())
      .post(`/ingestion/${documentId}/start`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('rejects ingestion when status is not startable', async () => {
    const token = await registerAndGetToken(`status-${Date.now()}`);
    const knowledgeBaseId = await createKnowledgeBase(
      token,
      `status-${Date.now()}`,
    );
    const documentId = await uploadTextDocument(
      token,
      knowledgeBaseId,
      'already-ready.txt',
      'ready-ready-ready',
    );

    await request(app.getHttpServer())
      .post(`/ingestion/${documentId}/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/ingestion/${documentId}/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });

  it('marks document failed and writes errorMessage when embeddings step fails', async () => {
    const token = await registerAndGetToken(`fail-${Date.now()}`);
    const knowledgeBaseId = await createKnowledgeBase(
      token,
      `fail-${Date.now()}`,
    );
    const documentId = await uploadTextDocument(
      token,
      knowledgeBaseId,
      'embedding-fail.txt',
      'embedding fail content',
    );

    jest
      .spyOn(ingestionEmbeddingsFactory, 'createEmbeddings')
      .mockReturnValue(new FailingEmbeddings());

    await request(app.getHttpServer())
      .post(`/ingestion/${documentId}/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(500);

    const failedDocument = await documentModel.findById(documentId).exec();
    expect(failedDocument?.status).toBe(DocumentStatusEnum.Failed);
    expect(failedDocument?.errorMessage).toContain('forced embedding failure');
  });

  it('cleans old chunks when retrying failed document ingestion', async () => {
    const token = await registerAndGetToken(`retry-${Date.now()}`);
    const knowledgeBaseId = await createKnowledgeBase(
      token,
      `retry-${Date.now()}`,
    );
    const documentId = await uploadTextDocument(
      token,
      knowledgeBaseId,
      'retry.txt',
      'chunk-a\nchunk-b\nchunk-c\nchunk-d\nchunk-e\nchunk-f',
    );

    const firstRunResponse = await request(app.getHttpServer())
      .post(`/ingestion/${documentId}/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(firstRunResponse.body.chunkCount).toBeGreaterThan(0);

    await documentModel
      .updateOne(
        { _id: new Types.ObjectId(documentId) },
        { status: DocumentStatusEnum.Failed },
      )
      .exec();

    const document = await documentModel.findById(documentId).exec();
    await chunkModel.create({
      userId: new Types.ObjectId(document!.userId),
      knowledgeBaseId: new Types.ObjectId(document!.knowledgeBaseId),
      documentId: new Types.ObjectId(documentId),
      chunkIndex: 999,
      content: 'stale-chunk',
      embedding: [0.1, 0.2],
      metadata: { source: 'stale' },
    });

    const retryResponse = await request(app.getHttpServer())
      .post(`/ingestion/${documentId}/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const chunksAfterRetry = await chunkModel
      .find({ documentId: new Types.ObjectId(documentId) })
      .sort({ chunkIndex: 1 })
      .exec();

    expect(chunksAfterRetry.length).toBe(retryResponse.body.chunkCount);
    expect(
      chunksAfterRetry.some(
        (chunk): boolean => chunk.content === 'stale-chunk',
      ),
    ).toBe(false);
  });

  it('allows only one concurrent ingestion start for the same document', async () => {
    const token = await registerAndGetToken(`race-${Date.now()}`);
    const knowledgeBaseId = await createKnowledgeBase(
      token,
      `race-${Date.now()}`,
    );
    const documentId = await uploadTextDocument(
      token,
      knowledgeBaseId,
      'race.txt',
      'race-1\nrace-2\nrace-3\nrace-4\nrace-5',
    );

    const [responseA, responseB] = await Promise.all([
      request(app.getHttpServer())
        .post(`/ingestion/${documentId}/start`)
        .set('Authorization', `Bearer ${token}`),
      request(app.getHttpServer())
        .post(`/ingestion/${documentId}/start`)
        .set('Authorization', `Bearer ${token}`),
    ]);

    const statusCodes = [responseA.status, responseB.status].sort(
      (a, b): number => a - b,
    );
    expect(statusCodes).toEqual([201, 409]);
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
  });
});
