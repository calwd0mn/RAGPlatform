import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { getJwtExpiresInSeconds, getJwtSecret } from './jwt.config';
import { JwtStrategy } from './strategies/jwt.strategy';

// 官方标准实现方法
@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: {
        expiresIn: getJwtExpiresInSeconds(),
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
