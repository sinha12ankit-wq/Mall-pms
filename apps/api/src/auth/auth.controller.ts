import { Body, Controller, Get, HttpCode, Post, UsePipes } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type AuthTokens,
  type LoginRequest,
  loginRequestSchema,
  type MeResponse,
  type RefreshRequest,
  refreshRequestSchema,
} from '@mall-pms/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import type { AuthUser } from './auth.types';
import { CurrentUser, Public } from './decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(loginRequestSchema))
  login(@Body() body: LoginRequest): Promise<AuthTokens> {
    return this.auth.login(body.email, body.password);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(refreshRequestSchema))
  refresh(@Body() body: RefreshRequest): Promise<AuthTokens> {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @UsePipes(new ZodValidationPipe(refreshRequestSchema))
  async logout(@Body() body: RefreshRequest): Promise<void> {
    await this.auth.logout(body.refreshToken);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.auth.me(user);
  }
}
