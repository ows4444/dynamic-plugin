import { Injectable, Logger } from '@nestjs/common';

export interface ExternalServiceContract {
  readonly serviceName: string;
  readonly version: string;
  readonly baseUrl: string;
}

export interface AdapterConfig {
  timeout: number;
  retries: number;
  circuitBreaker: {
    enabled: boolean;
    threshold: number;
    resetTimeout: number;
  };
  rateLimit: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
}

@Injectable()
export abstract class AntiCorruptionLayerAdapter<TContract extends ExternalServiceContract> {
  protected readonly logger = new Logger(this.constructor.name);
  
  constructor(
    protected readonly contract: TContract,
    protected readonly config: AdapterConfig
  ) {}

  protected abstract mapToInternalModel<T>(externalData: any): T;
  protected abstract mapToExternalModel<T>(internalData: T): any;
  protected abstract validateExternalResponse(response: any): boolean;
  protected abstract handleExternalError(error: any): Error;

  protected async executeWithResilience<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        const result = await this.withTimeout(operation(), this.config.timeout);
        return result;
      } catch (error) {
        lastError = this.handleExternalError(error);
        this.logger.warn(`Attempt ${attempt}/${this.config.retries} failed: ${lastError.message}`);
        
        if (attempt < this.config.retries) {
          await this.delay(Math.pow(2, attempt - 1) * 1000); // Exponential backoff
        }
      }
    }
    
    throw lastError;
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}