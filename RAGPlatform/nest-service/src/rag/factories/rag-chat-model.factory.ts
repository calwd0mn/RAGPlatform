import { AIMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { fakeModel } from '@langchain/core/testing';
import { Injectable, InternalServerErrorException } from '@nestjs/common';

const DEFAULT_PROVIDER = 'fake';
const DEFAULT_MODEL_NAME = 'fake-rag-model';

async function loadInitChatModel() {
  const { initChatModel } = await import('langchain/chat_models/universal');
  return initChatModel;
}

@Injectable()
export class RagChatModelFactory {
  async createDynamic(): Promise<BaseChatModel | null> {
    const provider = (process.env.RAG_CHAT_PROVIDER ?? DEFAULT_PROVIDER)
      .trim()
      .toLowerCase();

    if (provider === DEFAULT_PROVIDER) {
      return null;
    }

    const modelName = (process.env.RAG_CHAT_MODEL ?? '').trim();
    if (modelName.length === 0) {
      throw new InternalServerErrorException(
        'RAG_CHAT_MODEL is required when RAG_CHAT_PROVIDER is not fake',
      );
    }

    const initChatModel = await loadInitChatModel();
    return initChatModel(modelName, {
      modelProvider: provider,
      temperature: 0.2,
    });
  }

  async create(preparedAnswer: string): Promise<BaseChatModel> {
    const provider = (process.env.RAG_CHAT_PROVIDER ?? DEFAULT_PROVIDER)
      .trim()
      .toLowerCase();
    const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();

    if (provider === DEFAULT_PROVIDER) {
      if (nodeEnv === 'production') {
        throw new InternalServerErrorException(
          'RAG_CHAT_PROVIDER=fake is not allowed in production',
        );
      }
      return fakeModel().respond(new AIMessage(preparedAnswer));
    }

    const modelName = (process.env.RAG_CHAT_MODEL ?? '').trim();
    if (modelName.length === 0) {
      throw new InternalServerErrorException(
        'RAG_CHAT_MODEL is required when RAG_CHAT_PROVIDER is not fake',
      );
    }

    const model = await this.createDynamic();
    if (!model) {
      throw new InternalServerErrorException(
        'Dynamic chat model is unavailable for the current provider',
      );
    }

    return model;
  }

  getModelLabel(): string {
    const provider = (process.env.RAG_CHAT_PROVIDER ?? DEFAULT_PROVIDER)
      .trim()
      .toLowerCase();

    if (provider === DEFAULT_PROVIDER) {
      return DEFAULT_MODEL_NAME;
    }

    const modelName = (process.env.RAG_CHAT_MODEL ?? '').trim();
    if (modelName.length === 0) {
      return provider;
    }

    return `${provider}:${modelName}`;
  }
}
