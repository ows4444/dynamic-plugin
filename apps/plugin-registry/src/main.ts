import { NestFactory } from '@nestjs/core';
import { PluginRegistryModule } from './plugin-registry.module';

async function bootstrap() {
  const app = await NestFactory.create(PluginRegistryModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
