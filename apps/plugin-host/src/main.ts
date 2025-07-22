import { EnvironmentValidator, getErrorMessage, GlobalExceptionFilter } from '@lib/shared/common';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './core/app.module';

async function bootstrap() {
  const logger = new Logger('PluginHost');

  // Validate environment variables before starting the application
  try {
    const envValidator = new EnvironmentValidator();
    envValidator.validateAndThrow();
    logger.log('✅ Environment validation completed successfully');
  } catch (error) {
    logger.error('❌ Environment validation failed');
    logger.error(getErrorMessage(error));
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);

  // Global exception filter for consistent error handling
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global validation pipe for input validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable CORS for plugin development
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Plugin Host API')
    .setDescription('Dynamic Plugin System Host API for managing and running plugins')
    .setVersion('1.0')
    .addTag('plugins', 'Plugin management operations')
    .addTag('health', 'System health and monitoring')
    .addTag('runtime', 'Plugin runtime operations')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);

  logger.log(`🚀 Plugin Host is running on: http://localhost:${port}`);
  logger.log(`📚 API Documentation available at: http://localhost:${port}/api/docs`);
}
void bootstrap();
