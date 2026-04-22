import { BaseMessage, MessageContent } from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { Injectable } from '@nestjs/common';
import { RagPromptDefinition } from './prompt-registry';

export interface RenderedPromptMessage {
  role: string;
  content: string;
}

export interface PromptRenderResult {
  messages: RenderedPromptMessage[];
  promptText: string;
}

@Injectable()
export class PromptRenderer {
  createTemplate(definition: RagPromptDefinition): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages([
      ['system', definition.systemPrompt],
      ['system', definition.contextTemplate],
      new MessagesPlaceholder('history'),
      ['human', '{question}'],
    ]);
  }

  async render(input: {
    definition: RagPromptDefinition;
    context: string;
    history: BaseMessage[];
    question: string;
  }): Promise<PromptRenderResult> {
    const template = this.createTemplate(input.definition);
    const messages = await template.formatMessages({
      context: input.context,
      history: input.history,
      question: input.question,
    });

    const rendered = messages.map(
      (message): RenderedPromptMessage => ({
        role: message.getType(),
        content: this.normalizeMessageContent(message.content),
      }),
    );

    return {
      messages: rendered,
      promptText: rendered
        .map((item): string => `[${item.role}]\n${item.content}`)
        .join('\n\n'),
    };
  }

  private normalizeMessageContent(content: MessageContent): string {
    if (typeof content === 'string') {
      return content;
    }

    return content
      .map((part): string => {
        if (typeof part === 'string') {
          return part;
        }

        if (part.type === 'text' && typeof part.text === 'string') {
          return part.text;
        }

        return JSON.stringify(part);
      })
      .join('\n');
  }
}
