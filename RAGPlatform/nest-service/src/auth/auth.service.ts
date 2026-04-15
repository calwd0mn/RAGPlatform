import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponse, AuthUser } from './interfaces/auth-user.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';

interface MongoDuplicateKeyError {
  code?: number;
  keyPattern?: {
    email?: number;
    username?: number;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedUsername = dto.username.trim();

    const [emailUsed, usernameUsed] = await Promise.all([
      this.usersService.findByEmail(normalizedEmail),
      this.usersService.findByUsername(normalizedUsername),
    ]);

    if (emailUsed) {
      throw new BadRequestException('Email already exists');
    }
    if (usernameUsed) {
      throw new BadRequestException('Username already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService
      .create({
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash,
        avatar: dto.avatar,
      })
      .catch((error: MongoDuplicateKeyError): never => {
        if (error.code === 11000 && error.keyPattern?.email === 1) {
          throw new BadRequestException('Email already exists');
        }
        if (error.code === 11000 && error.keyPattern?.username === 1) {
          throw new BadRequestException('Username already exists');
        }
        throw error;
      });

    return this.buildAuthResponse({
      id: user.id,
      username: user.username,
      email: user.email,
    });
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse({
      id: user.id,
      username: user.username,
      email: user.email,
    });
  }

  async profile(userId: string): Promise<AuthUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
    };
  }

  private async signToken(user: AuthUser): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
    };
    return this.jwtService.signAsync(payload);
  }

  private async buildAuthResponse(user: AuthUser): Promise<AuthResponse> {
    return {
      accessToken: await this.signToken(user),
      user,
    };
  }
}
