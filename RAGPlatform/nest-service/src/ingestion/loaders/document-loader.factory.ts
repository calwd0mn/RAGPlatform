import { BadRequestException, Injectable } from '@nestjs/common';
import { Document as LangChainDocument } from '@langchain/core/documents';
import { promises as fsPromises } from 'fs';
import { extname } from 'path';
import { toDocumentAbsolutePath } from '../../documents/utils/document-file.util';
import { MineruService } from '../../mineru/mineru.service';

interface LoadDocumentInput {
  storagePath: string;
  originalName: string;
  mimeType: string;
  documentId: string;
}

@Injectable()
export class DocumentLoaderFactory {
  constructor(private readonly mineruService: MineruService) {}

  async load(input: LoadDocumentInput): Promise<LangChainDocument[]> {
    const absolutePath = toDocumentAbsolutePath(input.storagePath);
    const fileExtension = extname(input.originalName).toLowerCase();

    if (this.isPdf(input.mimeType, fileExtension)) {
      return this.loadPdfDocumentWithMineru(input, absolutePath);
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

  private async loadTextDocument(
    absolutePath: string,
  ): Promise<LangChainDocument[]> {
    const content = await fsPromises.readFile(absolutePath, {
      encoding: 'utf-8',
    });
    return [
      new LangChainDocument({
        pageContent: content,
        metadata: {
          source: absolutePath,
        },
      }),
    ];
  }

  private async loadPdfDocumentWithMineru(
    input: LoadDocumentInput,
    absolutePath: string,
  ): Promise<LangChainDocument[]> {
    const parseResult = await this.mineruService.parseFile({
      absoluteFilePath: absolutePath,
      originalName: input.originalName,
      mimeType: input.mimeType,
      documentId: input.documentId,
    });

    return [
      new LangChainDocument({
        pageContent: parseResult.markdown,
        metadata: {
          source: parseResult.artifactDirectoryPath,
          parser: 'mineru',
          parseMode: parseResult.mode,
        },
      }),
    ];
  }
}
