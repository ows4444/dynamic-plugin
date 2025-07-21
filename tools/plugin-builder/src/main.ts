import { NestFactory } from '@nestjs/core';
import { ToolspluginBuilderModule } from './tools/plugin-builder.module';

async function bootstrap() {
  const app = await NestFactory.create(ToolspluginBuilderModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
