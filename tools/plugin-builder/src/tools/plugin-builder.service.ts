import { Injectable } from '@nestjs/common';

@Injectable()
export class ToolspluginBuilderService {
  getHello(): string {
    return 'Hello World!';
  }
}
