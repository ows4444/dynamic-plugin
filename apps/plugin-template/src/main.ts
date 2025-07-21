import { NestFactory } from '@nestjs/core';
import { PluginTemplateModule } from './plugin-template.module';

async function bootstrap() {
  const app = await NestFactory.create(PluginTemplateModule);
  await app.listen(process.env.port ?? 3000);
}
void bootstrap();
