import { Injectable } from '@nestjs/common';

@Injectable()
export class PluginRegistryService {
  getHello(): string {
    return 'Hello World!';
  }
}
