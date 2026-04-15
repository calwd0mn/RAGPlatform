import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { CreateConversationDto } from '../dto/create-conversation.dto';
import { UpdateConversationDto } from '../dto/update-conversation.dto';
import { ConversationResponse } from '../interfaces/conversation-response.interface';
import { Conversation, ConversationDocument } from '../schemas/conversation.schema';

const DEFAULT_CONVERSATION_TITLE = '新会话';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
  ) {}

  async create(
    userId: string,
    dto: CreateConversationDto,
  ): Promise<ConversationResponse> {
    const normalizedUserId = this.toObjectId(userId);
    const now = new Date();
    const createdConversation = new this.conversationModel({
      userId: normalizedUserId,
      title: this.normalizeTitle(dto.title),
      lastMessageAt: now,
    });
    const savedConversation = await createdConversation.save();
    return this.toResponse(savedConversation);
  }

  async findAllByUser(userId: string): Promise<ConversationResponse[]> {
    const normalizedUserId = this.toObjectId(userId);
    const conversations = await this.conversationModel
      .find({ userId: normalizedUserId })
      .sort({ lastMessageAt: -1 })
      .exec();
    return conversations.map((conversation): ConversationResponse =>
      this.toResponse(conversation),
    );
  }

  async findOneByUser(userId: string, conversationId: string): Promise<ConversationResponse> {
    const conversation = await this.findOwnedConversation(userId, conversationId);
    return this.toResponse(conversation);
  }

  async ensureOwnedConversation(
    userId: string,
    conversationId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.findOwnedConversation(userId, conversationId, session);
  }

  async touchLastMessageAt(
    userId: string,
    conversationId: string,
    lastMessageAt: Date,
    session?: ClientSession,
  ): Promise<void> {
    const normalizedUserId = this.toObjectId(userId);
    const normalizedConversationId = this.toObjectId(conversationId);
    const updatedConversation = await this.conversationModel
      .findOneAndUpdate(
        { _id: normalizedConversationId, userId: normalizedUserId },
        { lastMessageAt },
        { new: true },
      )
      .session(session ?? null)
      .exec();

    if (!updatedConversation) {
      throw new NotFoundException('Conversation not found');
    }
  }

  async updateTitle(
    userId: string,
    conversationId: string,
    dto: UpdateConversationDto,
  ): Promise<ConversationResponse> {
    const normalizedUserId = this.toObjectId(userId);
    const normalizedConversationId = this.toObjectId(conversationId);
    const updatedConversation = await this.conversationModel
      .findOneAndUpdate(
        { _id: normalizedConversationId, userId: normalizedUserId },
        { title: this.normalizeTitle(dto.title) },
        { new: true },
      )
      .exec();

    if (!updatedConversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.toResponse(updatedConversation);
  }

  async remove(userId: string, conversationId: string): Promise<void> {
    const normalizedUserId = this.toObjectId(userId);
    const normalizedConversationId = this.toObjectId(conversationId);
    const deletedConversation = await this.conversationModel
      .findOneAndDelete({ _id: normalizedConversationId, userId: normalizedUserId })
      .exec();

    if (!deletedConversation) {
      throw new NotFoundException('Conversation not found');
    }
  }

  private async findOwnedConversation(
    userId: string,
    conversationId: string,
    session?: ClientSession,
  ): Promise<ConversationDocument> {
    const normalizedUserId = this.toObjectId(userId);
    const normalizedConversationId = this.toObjectId(conversationId);
    const conversation = await this.conversationModel
      .findOne({ _id: normalizedConversationId, userId: normalizedUserId })
      .session(session ?? null)
      .exec();

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  private normalizeTitle(title: string | undefined): string {
    const trimmedTitle = title?.trim();
    if (!trimmedTitle) {
      return DEFAULT_CONVERSATION_TITLE;
    }
    return trimmedTitle;
  }

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }
    return new Types.ObjectId(value);
  }

  private toResponse(conversation: ConversationDocument): ConversationResponse {
    return {
      id: conversation.id,
      userId: conversation.userId.toString(),
      title: conversation.title,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }
}
