import { BadRequestException, Injectable } from '@nestjs/common';
import { Document as LangChainDocument } from '@langchain/core/documents';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { promises as fsPromises } from 'fs';
import { extname } from 'path';
import { toDocumentAbsolutePath } from '../../documents/utils/document-file.util';

interface LoadDocumentInput {
  storagePath: string;
  originalName: string;
  mimeType: string;
}

async function loadPdfJsModule() {
  const pdfJsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return {
    getDocument: pdfJsModule.getDocument,
    version: pdfJsModule.version,
  };
}

@Injectable()
export class DocumentLoaderFactory {
  async load(input: LoadDocumentInput): Promise<LangChainDocument[]> {
    const absolutePath = toDocumentAbsolutePath(input.storagePath);
    const fileExtension = extname(input.originalName).toLowerCase();

    if (this.isPdf(input.mimeType, fileExtension)) {
      const loader = new PDFLoader(absolutePath, {
        splitPages: true,
        pdfjs: loadPdfJsModule,
      });
      return loader.load();
    }

    if (this.isTextLike(input.mimeType, fileExtension)) {
      return this.loadTextDocument(absolutePath);
    }

    throw new BadRequestException('Unsupported document type for ingestion');
  }

  private isPdf(mimeType: string, extension: string): boolean {
    return mimeType === 'application/pdf' || extension === '.pdf';
  }

  private isTextLike(mimeType: string, extension: string): boolean {
    const normalizedMimeType = mimeType.toLowerCase();
    return (
      normalizedMimeType === 'text/plain' ||
      normalizedMimeType === 'text/markdown' ||
      normalizedMimeType === 'text/x-markdown' ||
      extension === '.txt' ||
      extension === '.md'
    );
  }

  private async loadTextDocument(absolutePath: string): Promise<LangChainDocument[]> {
    const content = await fsPromises.readFile(absolutePath, { encoding: 'utf-8' });
    return [
      new LangChainDocument({
        pageContent: content,
        metadata: {
          source: absolutePath,
        },
      }),
    ];
  }
}
