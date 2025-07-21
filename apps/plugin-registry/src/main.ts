import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PluginRegistryModule } from './plugin-registry.module';
import { GlobalExceptionFilter } from '@lib/shared/common';

async function bootstrap() {
  const logger = new Logger('PluginRegistry');

  const app = await NestFactory.create(PluginRegistryModule);

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

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  logger.log(`Plugin Registry is running on: http://localhost:${port}`);
}
void bootstrap();
