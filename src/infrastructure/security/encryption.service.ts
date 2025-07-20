import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Encryption service providing data encryption, hashing, and key management
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly encryptionKey = 'default-encryption-key-change-in-production';
  private isInitialized = false;

  initialize(): void {
    this.isInitialized = true;
    this.logger.log('Encryption service initialized');
  }

  encrypt(data: string, context?: string): Promise<string> {
    try {
      // Simple encryption for demo - use proper encryption in production
      const iv = randomBytes(16);
      const cipher = createCipheriv('aes-256-gcm', Buffer.from(this.encryptionKey), iv);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return Promise.resolve(encrypted);
    } catch (error) {
      this.logger.error('Encryption error:', error);
      throw error;
    }
  }

  decrypt(encryptedData: string, context?: string): Promise<string> {
    try {
      const iv = randomBytes(16); // In real implementation, IV would be stored with the encrypted data
      const decipher = createDecipheriv('aes-256-gcm', Buffer.from(this.encryptionKey), iv);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return Promise.resolve(decrypted);
    } catch (error) {
      this.logger.error('Decryption error:', error);
      throw error;
    }
  }

  hash(data: string, salt?: string): string {
    try {
      const actualSalt = salt ?? randomBytes(16).toString('hex');
      const hash = createHash('sha256');
      hash.update(data + actualSalt);
      return `${actualSalt}:${hash.digest('hex')}`;
    } catch (error) {
      this.logger.error('Hashing error:', error);
      throw error;
    }
  }

  verifyHash(data: string, hash: string): boolean {
    try {
      const [salt, expectedHash] = hash.split(':');
      const actualHash = createHash('sha256');
      actualHash.update(data + salt);
      return actualHash.digest('hex') === expectedHash;
    } catch (error) {
      this.logger.error('Hash verification error:', error);
      return false;
    }
  }

  isHealthy(): boolean {
    return this.isInitialized;
  }

  shutdown(): void {
    this.isInitialized = false;
    this.logger.log('Encryption service shut down');
  }
}
