import { NestFactory } from '@nestjs/core';
import { PluginHostModule } from './plugin-host.module';

async function bootstrap() {
  const app = await NestFactory.create(PluginHostModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
