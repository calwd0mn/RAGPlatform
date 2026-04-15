import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { ConversationsService } from '../../conversations/services/conversations.service';
import { CreateMessageDto } from '../dto/create-message.dto';
import { MessageResponse } from '../interfaces/message-response.interface';
import { Message, MessageDocument } from '../schemas/message.schema';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly conversationsService: ConversationsService,
  ) {}

  async create(userId: string, dto: CreateMessageDto): Promise<MessageResponse> {
    const session = await this.connection.startSession();
    let savedMessage: MessageDocument | null = null;

    try {
      await session.withTransaction(async (): Promise<void> => {
        await this.conversationsService.ensureOwnedConversation(
          userId,
          dto.conversationId,
          session,
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

        savedMessage = await createdMessage.save({ session });

        await this.conversationsService.touchLastMessageAt(
          userId,
          dto.conversationId,
          savedMessage.createdAt,
          session,
        );
      });
    } finally {
      await session.endSession();
    }

    if (!savedMessage) {
      throw new InternalServerErrorException('Failed to create message');
    }

    return this.toResponse(savedMessage);
  }

  async findByConversation(
    userId: string,
    conversationId: string,
  ): Promise<MessageResponse[]> {
    await this.conversationsService.ensureOwnedConversation(userId, conversationId);

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
