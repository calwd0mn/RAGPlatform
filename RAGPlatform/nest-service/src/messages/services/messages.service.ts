import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConversationsService } from '../../conversations/services/conversations.service';
import { CreateMessageDto } from '../dto/create-message.dto';
import { MessageResponse } from '../interfaces/message-response.interface';
import { Message, MessageDocument } from '../schemas/message.schema';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    private readonly conversationsService: ConversationsService,
  ) {}
  async create(
    userId: string,
    dto: CreateMessageDto,
  ): Promise<MessageResponse> {
    // 保证只能操作自己的会话
    await this.conversationsService.ensureOwnedConversation(
      userId,
      dto.conversationId,
    );

    const normalizedUserId = this.toObjectId(userId);
    const normalizedConversationId = this.toObjectId(dto.conversationId);

    const createdMessage = new this.messageModel({
      userId: normalizedUserId,
      conversationId: normalizedConversationId,
      role: dto.role,
      content: dto.content.trim(),
      citations: [],
    });

    const savedMessage = await createdMessage.save();

    if (!savedMessage) {
      throw new InternalServerErrorException('Failed to create message');
    }

    await this.conversationsService.touchLastMessageAt(
      userId,
      dto.conversationId,
      savedMessage.createdAt,
    );

    return this.toResponse(savedMessage);
  }

  async findByConversation(
    userId: string,
    conversationId: string,
  ): Promise<MessageResponse[]> {
    await this.conversationsService.ensureOwnedConversation(
      userId,
      conversationId,
    );

    const normalizedUserId = this.toObjectId(userId);
    const normalizedConversationId = this.toObjectId(conversationId);

    const messages = await this.messageModel
      .find({
        userId: normalizedUserId,
        conversationId: normalizedConversationId,
      })
      .sort({ createdAt: 1 })
      .exec();

    return messages.map((message): MessageResponse => this.toResponse(message));
  }

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }

    return new Types.ObjectId(value);
  }

  private toResponse(message: MessageDocument): MessageResponse {
    return {
      id: message.id,
      conversationId: message.conversationId.toString(),
      userId: message.userId.toString(),
      role: message.role,
      content: message.content,
      citations: message.citations,
      trace: message.trace,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }
}
