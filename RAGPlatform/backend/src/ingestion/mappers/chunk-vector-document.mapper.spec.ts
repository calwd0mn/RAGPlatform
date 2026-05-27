import { Document as LangChainDocument } from '@langchain/core/documents';
import { Types } from 'mongoose';
import { ChunkVectorDocumentMapper } from './chunk-vector-document.mapper';

describe('ChunkVectorDocumentMapper', () => {
  const mapper = new ChunkVectorDocumentMapper();
  const userId = new Types.ObjectId('507f191e810c19729de860ea');
  const knowledgeBaseId = new Types.ObjectId('507f191e810c19729de860ec');
  const documentId = new Types.ObjectId('507f1f77bcf86cd799439051');
  const chunkId = new Types.ObjectId('507f1f77bcf86cd799439041');

  it('wraps chunk metadata for Atlas vector storage', () => {
    const sourceDocument = new LangChainDocument({
      pageContent: 'chunk content',
      metadata: {
        page: 3,
        originalName: 'manual.pdf',
      },
    });

    const result = mapper.toVectorDocument({
      chunkDocument: sourceDocument,
      chunkIndex: 2,
      userId,
      knowledgeBaseId,
      documentId,
    });

    expect(result.pageContent).toBe('chunk content');
    expect(result.metadata.userId).toBe(userId);
    expect(result.metadata.knowledgeBaseId).toBe(knowledgeBaseId);
    expect(result.metadata.documentId).toBe(documentId);
    expect(result.metadata.chunkIndex).toBe(2);
    expect(result.metadata.metadata).toEqual({
      page: 3,
      originalName: 'manual.pdf',
    });
  });

  it('maps Atlas vector search result to retrieved chunk', () => {
    const searchDocument = new LangChainDocument({
      pageContent: 'matched content',
      metadata: {
        _id: chunkId,
        userId,
        knowledgeBaseId,
        documentId,
        chunkIndex: 4,
        metadata: {
          page: 7,
          originalName: 'manual.pdf',
        },
      },
    });

    const result = mapper.toRetrievedChunk({
      document: searchDocument,
      score: 0.91,
      userId,
      knowledgeBaseId,
    });

    expect(result).toEqual({
      chunkId: chunkId.toString(),
      documentId: documentId.toString(),
      chunkIndex: 4,
      content: 'matched content',
      score: 0.91,
      metadata: {
        page: 7,
        originalName: 'manual.pdf',
      },
    });
  });

  it('filters vector search result outside the requested knowledge base', () => {
    const searchDocument = new LangChainDocument({
      pageContent: 'matched content',
      metadata: {
        _id: chunkId,
        userId,
        knowledgeBaseId: new Types.ObjectId('507f191e810c19729de860ed'),
        documentId,
        chunkIndex: 4,
        metadata: {
          originalName: 'manual.pdf',
        },
      },
    });

    const result = mapper.toRetrievedChunk({
      document: searchDocument,
      score: 0.91,
      userId,
      knowledgeBaseId,
    });

    expect(result).toBeNull();
  });
});
