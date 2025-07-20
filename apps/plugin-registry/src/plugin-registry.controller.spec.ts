import { Test, TestingModule } from '@nestjs/testing';
import { PluginRegistryController } from './plugin-registry.controller';
import { PluginRegistryService } from './plugin-registry.service';

describe('PluginRegistryController', () => {
  let pluginRegistryController: PluginRegistryController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [PluginRegistryController],
      providers: [PluginRegistryService],
    }).compile();

    pluginRegistryController = app.get<PluginRegistryController>(PluginRegistryController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(pluginRegistryController.getHello()).toBe('Hello World!');
    });
  });
});
