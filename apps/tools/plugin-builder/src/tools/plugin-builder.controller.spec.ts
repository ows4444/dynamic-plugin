import { Test, TestingModule } from '@nestjs/testing';
import { Tools/pluginBuilderController } from './tools/plugin-builder.controller';
import { Tools/pluginBuilderService } from './tools/plugin-builder.service';

describe('Tools/pluginBuilderController', () => {
  let tools/pluginBuilderController: Tools/pluginBuilderController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [Tools/pluginBuilderController],
      providers: [Tools/pluginBuilderService],
    }).compile();

    tools/pluginBuilderController = app.get<Tools/pluginBuilderController>(Tools/pluginBuilderController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(tools/pluginBuilderController.getHello()).toBe('Hello World!');
    });
  });
});
