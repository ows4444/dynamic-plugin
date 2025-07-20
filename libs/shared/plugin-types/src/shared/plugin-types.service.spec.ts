import { Test, TestingModule } from '@nestjs/testing';
import { Shared/pluginTypesService } from './shared/plugin-types.service';

describe('Shared/pluginTypesService', () => {
  let service: Shared/pluginTypesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Shared/pluginTypesService],
    }).compile();

    service = module.get<Shared/pluginTypesService>(Shared/pluginTypesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
