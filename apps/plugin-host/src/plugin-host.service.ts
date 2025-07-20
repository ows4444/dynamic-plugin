import { Injectable } from '@nestjs/common';

@Injectable()
export class PluginHostService {
  getHello(): string {
    return 'Hello World!';
  }
}
