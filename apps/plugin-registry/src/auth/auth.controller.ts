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
import { CreateTokenDto, JwtAuthService } from './jwt-auth.service';
import { AuthGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly jwtAuthService: JwtAuthService) {}

  @Post('tokens')
  @UseGuards(AuthGuard)
  async createToken(@Body() createTokenDto: CreateTokenDto) {
    const result = await this.jwtAuthService.createToken(createTokenDto);
    
    return {
      token: result.token,
      tokenInfo: {
        id: result.tokenInfo.id,
        userId: result.tokenInfo.userId,
        username: result.tokenInfo.username,
        permissions: result.tokenInfo.permissions,
        expiresAt: result.tokenInfo.expiresAt,
        createdAt: result.tokenInfo.createdAt,
      },
    };
  }

  @Post('tokens/refresh')
  @UseGuards(AuthGuard)
  async refreshToken(@Body('token') token: string) {
    const result = await this.jwtAuthService.refreshToken(token);
    
    if (!result) {
      return { error: 'Unable to refresh token' };
    }

    return {
      token: result.token,
      tokenInfo: {
        id: result.tokenInfo.id,
        userId: result.tokenInfo.userId,
        username: result.tokenInfo.username,
        permissions: result.tokenInfo.permissions,
        expiresAt: result.tokenInfo.expiresAt,
        createdAt: result.tokenInfo.createdAt,
      },
    };
  }

  @Delete('tokens/:token')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeToken(@Param('token') token: string) {
    await this.jwtAuthService.revokeToken(token);
  }

  @Get('tokens/stats')
  @UseGuards(AuthGuard)
  async getTokenStats() {
    return this.jwtAuthService.getTokenStats();
  }

  @Post('tokens/validate')
  async validateToken(@Body('token') token: string) {
    const isValid = await this.jwtAuthService.validateToken(token);
    const tokenInfo = isValid ? await this.jwtAuthService.getTokenInfo(token) : null;

    return {
      valid: isValid,
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