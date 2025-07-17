import { BasePluginTemplate } from '../base/plugin.template';

export abstract class GrpcPluginTemplate extends BasePluginTemplate {
  protected abstract readonly serviceName: string;
  protected abstract readonly protoPath: string;
  protected abstract readonly packageName: string;

  protected async onInitialize(): Promise<void> {
    this.logger.log(`gRPC plugin ${this.name} initialized for service: ${this.serviceName}`);
  }

  protected async onDestroy(): Promise<void> {
    this.logger.log(`gRPC plugin ${this.name} destroyed`);
  }

  protected async getHealthChecks() {
    return [
      {
        name: 'grpc-service',
        status: 'pass' as const,
        message: `gRPC service ${this.serviceName} is healthy`
      }
    ];
  }

  abstract getServiceImplementation(): any;
  abstract getProtoDefinition(): any;
}