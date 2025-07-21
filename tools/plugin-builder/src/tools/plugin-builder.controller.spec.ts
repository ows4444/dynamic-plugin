import { Test, TestingModule } from '@nestjs/testing';
import { ToolspluginBuilderController } from './plugin-builder.controller';
import { ToolspluginBuilderService } from './plugin-builder.service';

describe('Tools/pluginBuilderController', () => {
  let toolspluginBuilderController: ToolspluginBuilderController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ToolspluginBuilderController],
      providers: [ToolspluginBuilderService],
    }).compile();

    toolspluginBuilderController = app.get<ToolspluginBuilderController>(
      ToolspluginBuilderController,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(toolspluginBuilderController.getHello()).toBe('Hello World!');
    });
  });
});
