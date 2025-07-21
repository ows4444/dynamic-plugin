import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    try {
      const token = this.extractTokenFromHeader(request);

      if (!token) {
        throw new UnauthorizedException('Missing authentication token');
      }

      const isValid = await this.authService.validateToken(token);

      if (!isValid) {
        throw new UnauthorizedException('Invalid authentication token');
      }

      // Add token info to request for further processing
      const tokenInfo = await this.authService.getTokenInfo(token);
      request['user'] = tokenInfo;

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';
      this.logger.warn(`Authentication failed: ${errorMessage}`);
      throw error;
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ') ?? [];

    if (type !== 'Bearer') {
      return undefined;
    }

    return token;
  }
}
