import { Injectable } from '@nestjs/common';
import { RAG_SYSTEM_PROMPT } from '../prompts/rag-answer.prompt';
import type { AskMode } from '../dto/ask-rag.dto';

export interface RagPromptDefinition {
  id: string;
  version: string;
  versionedId: string;
  systemPrompt: string;
  contextTemplate: string;
}

const CURRENT_PROMPT: RagPromptDefinition = {
  id: 'rag-answer',
  version: 'v1',
  versionedId: 'rag-answer@v1',
  systemPrompt: RAG_SYSTEM_PROMPT,
  contextTemplate: '检索上下文如下：\n{context}',
};

const CHAT_ONLY_PROMPT: RagPromptDefinition = {
  id: 'chat-answer',
  version: 'v1',
  versionedId: 'chat-answer@v1',
  systemPrompt:
    '你是普通问答助手。请基于用户问题和对话历史回答，不使用知识库检索结果；如果不确定，请直接说明不确定。',
  contextTemplate: '当前为普通问答模式，未启用知识库检索。',
};

@Injectable()
export class PromptRegistry {
  getCurrent(mode: AskMode = 'rag'): RagPromptDefinition {
    if (mode === 'chat') {
      return CHAT_ONLY_PROMPT;
    }

    return CURRENT_PROMPT;
  }
}
