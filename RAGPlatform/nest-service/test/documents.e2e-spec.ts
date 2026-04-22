import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { existsSync, promises as fsPromises } from 'fs';
import { join } from 'path';
import { Connection, Model } from 'mongoose';
import request from 'supertest';
import { DOCUMENT_MAX_FILE_SIZE } from '../src/documents/constants/document.constants';
import {
  Document,
  DocumentDocument,
} from '../src/documents/schemas/document.schema';

jest.setTimeout(30000);

describe('Documents (e2e)', () => {
  let app: INestApplication;
  let connection: Connection;
  let documentModel: Model<DocumentDocument>;
  let documentsUploadDir: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI =
      process.env.MONGODB_URI ??
      'mongodb://127.0.0.1:27017/rag-platform-documents-e2e';
    process.env.DOCUMENTS_UPLOAD_DIR =
      process.env.DOCUMENTS_UPLOAD_DIR ??
      join(process.cwd(), 'uploads', 'documents-e2e');
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
  });

  beforeEach(async () => {
    await connection.dropDatabase();
    await fsPromises.rm(documentsUploadDir, { recursive: true, force: true });
    await fsPromises.mkdir(documentsUploadDir, { recursive: true });
  });

  async function registerAndGetToken(suffix: string): Promise<string> {
    const email = `doc-${suffix}@example.com`;
    const username = `doc_user_${suffix}`;
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

  it('uploads valid file and persists uploaded metadata', async () => {
    const token = await registerAndGetToken(`up-${Date.now()}`);
    const knowledgeBaseId = await createKnowledgeBase(
      token,
      `up-${Date.now()}`,
    );

    const uploadResponse = await request(app.getHttpServer())
      .post('/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('knowledgeBaseId', knowledgeBaseId)
      .attach('file', Buffer.from('# hello\ncontent'), {
        filename: 'sample.md',
        contentType: 'text/markdown',
      })
      .expect(201);

    expect(uploadResponse.body.status).toBe('uploaded');
    const savedDoc = await documentModel
      .findById(uploadResponse.body.id)
      .exec();
    expect(savedDoc).not.toBeNull();
    expect(savedDoc?.status).toBe('uploaded');
  });

  it('rejects unsupported file type upload', async () => {
    const token = await registerAndGetToken(`type-${Date.now()}`);
    const knowledgeBaseId = await createKnowledgeBase(
      token,
      `type-${Date.now()}`,
    );

    await request(app.getHttpServer())
      .post('/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('knowledgeBaseId', knowledgeBaseId)
      .attach('file', Buffer.from('MZ'), {
        filename: 'malware.exe',
        contentType: 'application/octet-stream',
      })
      .expect(400);
  });

  it('rejects oversized file upload', async () => {
    const token = await registerAndGetToken(`size-${Date.now()}`);
    const knowledgeBaseId = await createKnowledgeBase(
      token,
      `size-${Date.now()}`,
    );

    await request(app.getHttpServer())
      .post('/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('knowledgeBaseId', knowledgeBaseId)
      .attach('file', Buffer.alloc(DOCUMENT_MAX_FILE_SIZE + 1, 65), {
        filename: 'large.txt',
        contentType: 'text/plain',
      })
      .expect(413);
  });

  it('returns only current user documents in list', async () => {
    const base = Date.now();
    const user1Token = await registerAndGetToken(`list-a-${base}`);
    const user2Token = await registerAndGetToken(`list-b-${base}`);
    const user1KnowledgeBaseId = await createKnowledgeBase(
      user1Token,
      `list-a-${base}`,
    );
    const user2KnowledgeBaseId = await createKnowledgeBase(
      user2Token,
      `list-b-${base}`,
    );

    const doc1 = await request(app.getHttpServer())
      .post('/documents/upload')
      .set('Authorization', `Bearer ${user1Token}`)
      .field('knowledgeBaseId', user1KnowledgeBaseId)
      .attach('file', Buffer.from('first'), {
        filename: 'first.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    const doc2 = await request(app.getHttpServer())
      .post('/documents/upload')
      .set('Authorization', `Bearer ${user1Token}`)
      .field('knowledgeBaseId', user1KnowledgeBaseId)
      .attach('file', Buffer.from('second-from-user1'), {
        filename: 'second-user1.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/documents/upload')
      .set('Authorization', `Bearer ${user2Token}`)
      .field('knowledgeBaseId', user2KnowledgeBaseId)
      .attach('file', Buffer.from('third-from-user2'), {
        filename: 'third-user2.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    const listResponse = await request(app.getHttpServer())
      .get('/documents')
      .set('Authorization', `Bearer ${user1Token}`)
      .query({ knowledgeBaseId: user1KnowledgeBaseId })
      .expect(200);

    expect(listResponse.body).toHaveLength(2);
    expect(listResponse.body[0].id).toBe(doc2.body.id);
    expect(listResponse.body[1].id).toBe(doc1.body.id);
  });

  it('returns not found when reading another user document detail', async () => {
    const base = Date.now();
    const ownerToken = await registerAndGetToken(`detail-a-${base}`);
    const otherToken = await registerAndGetToken(`detail-b-${base}`);
    const ownerKnowledgeBaseId = await createKnowledgeBase(
      ownerToken,
      `detail-a-${base}`,
    );

    const uploaded = await request(app.getHttpServer())
      .post('/documents/upload')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('knowledgeBaseId', ownerKnowledgeBaseId)
      .attach('file', Buffer.from('secret'), {
        filename: 'secret.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/documents/${uploaded.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('deletes own document successfully', async () => {
    const token = await registerAndGetToken(`del-${Date.now()}`);
    const knowledgeBaseId = await createKnowledgeBase(
      token,
      `del-${Date.now()}`,
    );

    const uploaded = await request(app.getHttpServer())
      .post('/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('knowledgeBaseId', knowledgeBaseId)
      .attach('file', Buffer.from('to delete'), {
        filename: 'delete-me.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    const savedDoc = await documentModel.findById(uploaded.body.id).exec();
    expect(savedDoc).not.toBeNull();
    const absoluteFilePath = join(process.cwd(), savedDoc!.storagePath);
    expect(existsSync(absoluteFilePath)).toBe(true);

    await request(app.getHttpServer())
      .delete(`/documents/${uploaded.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    const deletedDoc = await documentModel.findById(uploaded.body.id).exec();
    expect(deletedDoc).toBeNull();
    expect(existsSync(absoluteFilePath)).toBe(false);
  });

  it('returns not found when deleting another user document', async () => {
    const base = Date.now();
    const ownerToken = await registerAndGetToken(`del-own-${base}`);
    const otherToken = await registerAndGetToken(`del-other-${base}`);
    const ownerKnowledgeBaseId = await createKnowledgeBase(
      ownerToken,
      `del-own-${base}`,
    );

    const uploaded = await request(app.getHttpServer())
      .post('/documents/upload')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('knowledgeBaseId', ownerKnowledgeBaseId)
      .attach('file', Buffer.from('doc'), {
        filename: 'owner.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/documents/${uploaded.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('deletes database record even if physical file is missing', async () => {
    const token = await registerAndGetToken(`missing-${Date.now()}`);
    const knowledgeBaseId = await createKnowledgeBase(
      token,
      `missing-${Date.now()}`,
    );

    const uploaded = await request(app.getHttpServer())
      .post('/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('knowledgeBaseId', knowledgeBaseId)
      .attach('file', Buffer.from('missing-file'), {
        filename: 'missing.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    const savedDoc = await documentModel.findById(uploaded.body.id).exec();
    expect(savedDoc).not.toBeNull();
    const absoluteFilePath = join(process.cwd(), savedDoc!.storagePath);
    await fsPromises.rm(absoluteFilePath, { force: true });

    await request(app.getHttpServer())
      .delete(`/documents/${uploaded.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    const deletedDoc = await documentModel.findById(uploaded.body.id).exec();
    expect(deletedDoc).toBeNull();
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
