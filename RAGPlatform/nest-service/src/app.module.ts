import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { DocumentsModule } from './documents/documents.module';
import { RagModule } from './rag/rag.module';

const shouldConnectMongo =
  process.env.NODE_ENV !== 'test' || Boolean(process.env.MONGODB_URI);

const databaseImports = shouldConnectMongo
  ? [
      MongooseModule.forRoot(
        process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/rag-platform',
        {
          serverSelectionTimeoutMS: 5000,
        },
      ),
    ]
  : [];

@Module({
  imports: [
    ...databaseImports,
    AuthModule,
    UsersModule,
    ConversationsModule,
    MessagesModule,
    DocumentsModule,
    RagModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
