import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        disableErrorMessages: false,
      }),
    );

    // CORS configuration
    app.enableCors({
      origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    });
    // Global prefix
    // app.setGlobalPrefix('api/v1');
    // Swagger API documentation
    const config = new DocumentBuilder()
      .setTitle('Dynamic Plugin System')
      .setDescription('Enterprise-grade dynamic plugin system for NestJS')
      .setVersion('1.0.0')
      .addTag('plugins', 'Plugin management operations')
      .addTag('registry', 'Plugin registry operations')
      .addTag('security', 'Plugin security operations')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config, { ignoreGlobalPrefix: true });

    // Make Swagger UI consistent with global API prefix
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    const port = process.env.PORT ?? 3000;
    await app.listen(port);

    logger.log(`🚀 Dynamic Plugin System is running on: http://localhost:${port}`);
    logger.log(`📚 API Documentation available at: http://localhost:${port}/docs`);
    logger.log(`🔧 Environment: ${process.env.NODE_ENV ?? 'development'}`);
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

void bootstrap();
