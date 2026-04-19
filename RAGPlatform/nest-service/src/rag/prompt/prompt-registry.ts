import { Injectable } from '@nestjs/common';
import { RAG_SYSTEM_PROMPT } from '../prompts/rag-answer.prompt';
import { PromptDraft } from '../../schemas/debug-experiment.schema';

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

@Injectable()
export class PromptRegistry {
  getCurrent(): RagPromptDefinition {
    return CURRENT_PROMPT;
  }

  resolveDraft(draft?: PromptDraft): RagPromptDefinition {
    if (!draft) {
      return this.getCurrent();
    }

    const baseVersion = draft.versionLabel?.trim();
    const version = baseVersion && baseVersion.length > 0 ? baseVersion : 'draft';

    return {
      id: draft.basePromptId,
      version,
      versionedId: `${draft.basePromptId}@${version}`,
      systemPrompt: draft.systemPrompt,
      contextTemplate: draft.contextTemplate,
    };
  }
}
