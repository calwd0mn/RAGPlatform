export enum MessageRoleEnum {
  User = 'user',
  Assistant = 'assistant',
  System = 'system',
}

export const MESSAGE_ROLES = [
  MessageRoleEnum.User,
  MessageRoleEnum.Assistant,
  MessageRoleEnum.System,
] as const;

export type MessageRole = MessageRoleEnum;
