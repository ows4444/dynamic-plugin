import { NestFactory } from '@nestjs/core';
import { AppModule } from './core/app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('PluginHost');

  const app = await NestFactory.create(AppModule);

  // Enable CORS for plugin development
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`Plugin Host is running on: http://localhost:${port}`);
}
bootstrap();
