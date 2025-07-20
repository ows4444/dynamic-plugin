import { Global, Module } from '@nestjs/common';
import { SecurityService } from './security.service';
import { AuthenticationService } from './authentication.service';
import { AuthorizationService } from './authorization.service';
import { EncryptionService } from './encryption.service';
import { AuditService } from './audit.service';

/**
 * Global security module providing comprehensive security services
 * Includes authentication, authorization, encryption, and auditing
 */
@Global()
@Module({
  providers: [SecurityService, AuthenticationService, AuthorizationService, EncryptionService, AuditService],
  exports: [SecurityService, AuthenticationService, AuthorizationService, EncryptionService, AuditService],
})
export class SecurityModule {}
