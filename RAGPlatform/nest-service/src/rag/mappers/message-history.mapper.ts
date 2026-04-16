import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Injectable } from '@nestjs/common';
import { MessageRoleEnum } from '../../messages/interfaces/message-role.type';

interface MessageHistoryItem {
  role: MessageRoleEnum;
  content: string;
}

@Injectable()
export class MessageHistoryMapper {
  toLangchainMessages(messages: MessageHistoryItem[]): BaseMessage[] {
    return messages.map((message): BaseMessage => {
      if (message.role === MessageRoleEnum.User) {
        return new HumanMessage(message.content);
      }

      if (message.role === MessageRoleEnum.Assistant) {
        return new AIMessage(message.content);
      }

      return new SystemMessage(message.content);
    });
  }
}