import { Test, TestingModule } from '@nestjs/testing';
import { PluginTemplateController } from './plugin-template.controller';
import { PluginTemplateService } from './plugin-template.service';

describe('PluginTemplateController', () => {
  let pluginTemplateController: PluginTemplateController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [PluginTemplateController],
      providers: [PluginTemplateService],
    }).compile();

    pluginTemplateController = app.get<PluginTemplateController>(PluginTemplateController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(pluginTemplateController.getHello()).toBe('Hello World!');
    });
  });
});
