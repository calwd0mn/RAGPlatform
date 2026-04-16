import { Embeddings, EmbeddingsParams } from '@langchain/core/embeddings';

const DEFAULT_VECTOR_SIZE = 256;

export class DeterministicEmbeddings extends Embeddings {
  private readonly vectorSize: number;

  constructor(params?: EmbeddingsParams, vectorSize = DEFAULT_VECTOR_SIZE) {
    super(params ?? {});
    this.vectorSize = vectorSize;
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return documents.map((document): number[] => this.embedText(document));
  }

  async embedQuery(document: string): Promise<number[]> {
    return this.embedText(document);
  }

  private embedText(content: string): number[] {
    const result: number[] = new Array<number>(this.vectorSize).fill(0);
    const normalized = content.normalize('NFKC');

    for (let index = 0; index < normalized.length; index += 1) {
      const codePoint = normalized.charCodeAt(index);
      const vectorIndex = index % this.vectorSize;
      result[vectorIndex] += codePoint / 65535;
    }

    return result;
  }
}

