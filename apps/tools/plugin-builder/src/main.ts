import { NestFactory } from '@nestjs/core';
import { Tools/pluginBuilderModule } from './tools/plugin-builder.module';

async function bootstrap() {
  const app = await NestFactory.create(Tools/pluginBuilderModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
