import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PluginModule } from './plugins/plugin.module';
import { RegistryModule } from './registry/registry.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule,
    PluginModule,
    RegistryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}