import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { CreateTokenDto, JwtAuthService } from './jwt-auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly jwtAuthService: JwtAuthService) {}

  @Post('tokens')
  @UseGuards(AuthGuard)
  async createToken(@Body() createTokenDto: CreateTokenDto): Promise<{token: string; tokenInfo: {id: string; userId: string; name: string; permissions: string[]; createdAt: Date; expiresAt: Date; lastUsed: Date | null}}> {
    const result = await this.jwtAuthService.createToken(createTokenDto);
    
    return {
      token: result.token,
      tokenInfo: {
        id: result.tokenInfo.id,
        userId: result.tokenInfo.userId,
        name: result.tokenInfo.username ?? result.tokenInfo.userId,
        permissions: result.tokenInfo.permissions,
        expiresAt: result.tokenInfo.expiresAt,
        createdAt: result.tokenInfo.createdAt,
        lastUsed: result.tokenInfo.lastUsed ?? null,
      },
    };
  }

  @Post('tokens/refresh')
  @UseGuards(AuthGuard)
  async refreshToken(@Body('token') token: string): Promise<{token?: string; tokenInfo?: unknown; error?: string}> {
    const result = await this.jwtAuthService.refreshToken(token);
    
    if (!result) {
      return { error: 'Unable to refresh token' };
    }

    return {
      token: result.token,
      tokenInfo: {
        id: result.tokenInfo.id,
        userId: result.tokenInfo.userId,
        name: result.tokenInfo.username ?? result.tokenInfo.userId,
        permissions: result.tokenInfo.permissions,
        expiresAt: result.tokenInfo.expiresAt,
        createdAt: result.tokenInfo.createdAt,
        lastUsed: result.tokenInfo.lastUsed ?? null,
      },
    };
  }

  @Delete('tokens/:token')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeToken(@Param('token') token: string): Promise<void> {
    await this.jwtAuthService.revokeToken(token);
  }

  @Get('tokens/stats')
  @UseGuards(AuthGuard)
  async getTokenStats(): Promise<unknown> {
    return this.jwtAuthService.getTokenStats();
  }

  @Post('tokens/validate')
  async validateToken(@Body('token') token: string): Promise<{isValid: boolean; tokenInfo: unknown}> {
    const isValid = await this.jwtAuthService.validateToken(token);
    const tokenInfo = isValid ? await this.jwtAuthService.getTokenInfo(token) : null;

    return {
      isValid,
      tokenInfo: tokenInfo ? {
        id: tokenInfo.id,
        userId: tokenInfo.userId,
        username: tokenInfo.username,
        permissions: tokenInfo.permissions,
        expiresAt: tokenInfo.expiresAt,
        lastUsed: tokenInfo.lastUsed,
        isActive: tokenInfo.isActive,
      } : null,
    };
  }
}