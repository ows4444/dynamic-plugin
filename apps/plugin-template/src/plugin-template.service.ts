import { Injectable } from '@nestjs/common';

@Injectable()
export class PluginTemplateService {
  getHello(): string {
    return 'Hello World!';
  }
}
