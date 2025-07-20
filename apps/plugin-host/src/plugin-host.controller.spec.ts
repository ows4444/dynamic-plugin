import { Test, TestingModule } from '@nestjs/testing';
import { PluginHostController } from './plugin-host.controller';
import { PluginHostService } from './plugin-host.service';

describe('PluginHostController', () => {
  let pluginHostController: PluginHostController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [PluginHostController],
      providers: [PluginHostService],
    }).compile();

    pluginHostController = app.get<PluginHostController>(PluginHostController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(pluginHostController.getHello()).toBe('Hello World!');
    });
  });
});
