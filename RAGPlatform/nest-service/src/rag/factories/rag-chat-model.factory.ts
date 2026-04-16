import { AIMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { fakeModel } from '@langchain/core/testing';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { initChatModel } from 'langchain/chat_models/universal';

const DEFAULT_PROVIDER = 'fake';
const DEFAULT_MODEL_NAME = 'fake-rag-model';

@Injectable()
export class RagChatModelFactory {
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

    return initChatModel(modelName, {
      modelProvider: provider,
      temperature: 0.2,
    });
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
