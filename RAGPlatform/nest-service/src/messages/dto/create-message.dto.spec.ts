import { validate } from 'class-validator';
import { MessageRoleEnum } from '../interfaces/message-role.type';
import { CreateMessageDto } from './create-message.dto';

describe('CreateMessageDto', () => {
  it('fails when role is invalid', async () => {
    const dto = new CreateMessageDto();
    dto.conversationId = '507f1f77bcf86cd799439011';
    dto.role = 'invalid-role' as MessageRoleEnum;
    dto.content = 'hello';

    const errors = await validate(dto);

    expect(errors.some((item) => item.property === 'role')).toBe(true);
  });

  it('fails when content is empty', async () => {
    const dto = new CreateMessageDto();
    dto.conversationId = '507f1f77bcf86cd799439011';
    dto.role = MessageRoleEnum.User;
    dto.content = '';

    const errors = await validate(dto);

    expect(errors.some((item) => item.property === 'content')).toBe(true);
  });

  it('fails when content only contains whitespace', async () => {
    const dto = new CreateMessageDto();
    dto.conversationId = '507f1f77bcf86cd799439011';
    dto.role = MessageRoleEnum.User;
    dto.content = '   ';

    const errors = await validate(dto);

    expect(errors.some((item) => item.property === 'content')).toBe(true);
  });
});
