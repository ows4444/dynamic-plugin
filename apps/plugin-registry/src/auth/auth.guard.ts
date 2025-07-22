import { getErrorMessage } from '@lib/shared/common';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthService } from './jwt-auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly authService: AuthService,
    private readonly jwtAuthService: JwtAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    try {
      const token = this.extractTokenFromHeader(request);

      if (token == null) {
        throw new UnauthorizedException('Missing authentication token');
      }

      // Try JWT authentication first, fallback to legacy token auth
      let isValid = await this.jwtAuthService.validateToken(token);
      let tokenInfo = await this.jwtAuthService.getTokenInfo(token);

      if (!isValid) {
        // Fallback to legacy authentication for backward compatibility
        isValid = await this.authService.validateToken(token);
        tokenInfo = await this.authService.getTokenInfo(token);
      }

      if (!isValid) {
        throw new UnauthorizedException('Invalid authentication token');
      }

      // Add token info to request for further processing
      request['user'] = tokenInfo;

      return true;
    } catch (error) {
      const errorMessage = getErrorMessage(error, 'Unknown authentication error') ;
      this.logger.warn(`Authentication failed: ${errorMessage}`);
      throw error;
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;

    if (authHeader == null) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ') ?? [];

    if (type !== 'Bearer') {
      return undefined;
    }

    return token;
  }
}
