import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));
  
  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());
  
  // CORS configuration
  const corsConfig = configService.corsConfig;
  app.enableCors({
    origin: corsConfig.origin,
    methods: corsConfig.methods,
    allowedHeaders: corsConfig.allowedHeaders,
    credentials: corsConfig.credentials,
  });
  
  // Swagger documentation
  const swaggerConfig = configService.swaggerConfig;
  if (swaggerConfig.enabled) {
    const config = new DocumentBuilder()
      .setTitle('Dynamic Plugin System API')
      .setDescription(`
        ## Enterprise-Grade Dynamic Plugin Architecture

        This API provides comprehensive plugin management capabilities including:

        ### 🔧 Core Features
        - **Dynamic Plugin Loading**: Load, unload, and reload plugins at runtime
        - **Sandboxed Execution**: Secure isolated execution environment for plugins
        - **Hot Reload**: Update plugins without service interruption
        - **Multi-tenant Support**: Isolated plugin instances per tenant
        - **Dependency Management**: Automatic dependency resolution and validation

        ### 🛡️ Security & Monitoring
        - **Security Validation**: Comprehensive security checks and permissions
        - **Resource Monitoring**: Real-time CPU, memory, and performance metrics
        - **Health Checks**: Automated plugin health monitoring
        - **Audit Logging**: Complete audit trail for all plugin operations

        ### 📊 Plugin Registry
        - **Version Management**: Semantic versioning with conflict resolution
        - **Plugin Discovery**: Automated plugin marketplace integration
        - **Configuration Management**: Environment-specific configurations

        ### 🚀 Developer Tools
        - **Plugin CLI**: Command-line tools for plugin development
        - **Build System**: Automated plugin build and packaging
        - **Testing Framework**: Comprehensive testing utilities

        For detailed documentation and examples, visit our [GitHub repository](https://github.com/enterprise/dynamic-plugin).
      `)
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth'
      )
      .addApiKey(
        {
          type: 'apiKey',
          name: 'X-API-Key',
          in: 'header',
          description: 'API Key for service-to-service authentication'
        },
        'API-Key'
      )
      .addTag('plugins', 'Plugin Management - Core CRUD operations for plugins')
      .addTag('plugin-registry', 'Plugin Registry - Marketplace and discovery features')
      .addTag('plugin-lifecycle', 'Plugin Lifecycle - Installation, updates, and lifecycle management')
      .addTag('plugin-security', 'Plugin Security - Security validation and sandbox management')
      .addTag('plugin-monitoring', 'Plugin Monitoring - Health checks, metrics, and performance')
      .addTag('dynamic-routes', 'Dynamic Routes - Plugin-generated API endpoints')
      .addTag('system', 'System - Application health and information')
      .addServer('http://localhost:3000', 'Development Server')
      .addServer('https://api.yourcompany.com', 'Production Server')
      .setContact('Enterprise Platform Team', 'https://yourcompany.com/platform', 'platform@yourcompany.com')
      .setLicense('MIT', 'https://opensource.org/licenses/MIT')
      .setExternalDoc('Plugin Development Guide', 'https://docs.yourcompany.com/plugins')
      .build();
    
    const document = SwaggerModule.createDocument(app, config, {
      operationIdFactory: (_: string, methodKey: string) => methodKey,
      deepScanRoutes: true,
    });
    
    SwaggerModule.setup(swaggerConfig.path, app, document, {
      customSiteTitle: 'Dynamic Plugin System API',
      customfavIcon: '/favicon.ico',
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info .title { color: #1976d2; }
        .swagger-ui .scheme-container { background: #fafafa; padding: 15px; border-radius: 4px; }
      `,
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
        tryItOutEnabled: true,
      },
    });
  }
  
  // Start server
  const port = configService.port;
  await app.listen(port);
  
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  if (swaggerConfig.enabled) {
    console.log(`📖 Swagger documentation: http://localhost:${port}/${swaggerConfig.path}`);
  }
}

bootstrap();