import { Test, TestingModule } from '@nestjs/testing';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { UploadedDocumentFile } from './interfaces/uploaded-document-file.interface';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let service: {
    createFromUpload: jest.Mock;
    findAllByUser: jest.Mock;
    findOneByUser: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      createFromUpload: jest.fn(),
      findAllByUser: jest.fn(),
      findOneByUser: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        {
          provide: DocumentsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
  });

  it('forwards upload to service with current user id', async () => {
    const user: AuthUser = {
      id: 'u1',
      username: 'tester',
      email: 'tester@example.com',
    };
    service.createFromUpload.mockResolvedValue({});
    const file = { originalname: 'a.txt' } as UploadedDocumentFile;

    await controller.upload(user, { knowledgeBaseId: 'kb-1' }, file);

    expect(service.createFromUpload).toHaveBeenCalledWith('u1', 'kb-1', file);
  });

  it('forwards list query to service with current user id', async () => {
    const user: AuthUser = {
      id: 'u1',
      username: 'tester',
      email: 'tester@example.com',
    };
    service.findAllByUser.mockResolvedValue([]);

    await controller.findAll(user, { knowledgeBaseId: 'kb-1' });

    expect(service.findAllByUser).toHaveBeenCalledWith('u1', 'kb-1');
  });

  it('forwards delete to service with route param id', async () => {
    const user: AuthUser = {
      id: 'u1',
      username: 'tester',
      email: 'tester@example.com',
    };
    service.remove.mockResolvedValue(undefined);

    await controller.remove(user, { id: 'doc-1' });

    expect(service.remove).toHaveBeenCalledWith('u1', 'doc-1');
  });
});
