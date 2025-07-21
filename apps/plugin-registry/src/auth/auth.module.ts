import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { JwtAuthService } from './jwt-auth.service';
import { AuthController } from './auth.controller';
import { AppConfiguration } from '@lib/shared/common';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService<AppConfiguration>) => {
        const securityConfig = configService.get('security', { infer: true });
        
        if (!securityConfig) {
          throw new Error('Security configuration is required');
        }

        return {
          secret: securityConfig.jwtSecret,
          signOptions: {
            expiresIn: securityConfig.jwtExpiresIn,
            issuer: 'plugin-registry',
            audience: 'plugin-system',
          },
          verifyOptions: {
            issuer: 'plugin-registry',
            audience: 'plugin-system',
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthGuard, 
    AuthService,     // Keep for backward compatibility during migration
    JwtAuthService,  // New JWT-based service
  ],
  exports: [AuthGuard, AuthService, JwtAuthService],
})
export class AuthModule {}
