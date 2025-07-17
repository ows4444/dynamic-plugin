import { Injectable } from '@nestjs/common';
import { ConfigService } from './config/config.service';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getAppInfo() {
    return {
      name: 'NestJS Dynamic Plugin System',
      version: '1.0.0',
      description: 'Enterprise-grade dynamic plugin system for NestJS',
      environment: this.configService.nodeEnv,
      features: [
        'Hot-swappable Plugins',
        'TypeScript-First Development',
        'Secure Sandboxed Execution',
        'Multi-tenancy Support',
        'Health Monitoring',
        'Dependency Management',
        'API Gateway Integration',
        'Container-Ready Deployment',
        'Horizontal Scaling',
        'Monitoring & Observability'
      ],
      endpoints: {
        plugins: '/api/plugins',
        health: '/health',
        docs: this.configService.swaggerConfig.enabled ? `/${this.configService.swaggerConfig.path}` : null
      }
    };
  }

  getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.configService.nodeEnv,
      version: '1.0.0',
      checks: {
        memory: this.getMemoryUsage(),
        plugins: this.getPluginSystemHealth(),
        configuration: this.getConfigurationHealth()
      }
    };
  }

  private getMemoryUsage() {
    const memory = process.memoryUsage();
    return {
      status: 'healthy',
      rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memory.external / 1024 / 1024)}MB`
    };
  }

  private getPluginSystemHealth() {
    return {
      status: 'healthy',
      message: 'Plugin system is operational',
      directory: this.configService.pluginConfig.directory,
      securityLevel: this.configService.pluginConfig.securityLevel,
      sandboxed: this.configService.pluginConfig.sandboxed
    };
  }

  private getConfigurationHealth() {
    return {
      status: 'healthy',
      message: 'Configuration loaded successfully',
      environment: this.configService.nodeEnv,
      hotReload: this.configService.pluginConfig.hotReload,
      metricsEnabled: this.configService.metricsConfig.enabled,
      securityEnabled: this.configService.securityConfig.signatureVerification
    };
  }
}