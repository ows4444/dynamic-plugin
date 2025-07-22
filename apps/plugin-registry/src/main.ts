import { EnvironmentValidator, getErrorMessage, GlobalExceptionFilter } from '@lib/shared/common';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('PluginRegistry');

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

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Plugin Registry API')
    .setDescription('Plugin Registry API for uploading, downloading, and managing plugin packages')
    .setVersion('1.0')
    .addTag('upload', 'Plugin upload operations')
    .addTag('download', 'Plugin download operations')
    .addTag('metadata', 'Plugin metadata management')
    .addTag('auth', 'Authentication operations')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);

  logger.log(`🚀 Plugin Registry is running on: http://localhost:${port}`);
  logger.log(`📚 API Documentation available at: http://localhost:${port}/api/docs`);
}
void bootstrap();
