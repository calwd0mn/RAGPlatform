import { Injectable } from '@nestjs/common';
import { Document as LangChainDocument } from '@langchain/core/documents';
import { ChunkMetadata } from '../interfaces/chunk-metadata.interface';

interface LoaderMetadataProbe {
  source?: string;
  page?: number;
  loc?: {
    pageNumber?: number;
  };
}

interface MapLoadedDocumentsInput {
  loadedDocuments: LangChainDocument[];
  userId: string;
  documentId: string;
  originalName: string;
  mimeType: string;
}

@Injectable()
export class LangchainDocumentMapper {
  mapLoadedDocuments(input: MapLoadedDocumentsInput): LangChainDocument<ChunkMetadata>[] {
    return input.loadedDocuments.map((loadedDocument: LangChainDocument): LangChainDocument<ChunkMetadata> => {
      const metadataProbe = loadedDocument.metadata as LoaderMetadataProbe;
      const pageFromLoc =
        metadataProbe.loc && typeof metadataProbe.loc.pageNumber === 'number'
          ? metadataProbe.loc.pageNumber
          : undefined;

      const page = typeof metadataProbe.page === 'number' ? metadataProbe.page : pageFromLoc;
      const source =
        typeof metadataProbe.source === 'string' && metadataProbe.source.trim().length > 0
          ? metadataProbe.source
          : undefined;

      return new LangChainDocument<ChunkMetadata>({
        pageContent: loadedDocument.pageContent,
        metadata: {
          page,
          source,
          originalName: input.originalName,
          mimeType: input.mimeType,
          documentId: input.documentId,
          userId: input.userId,
        },
      });
    });
  }
}
