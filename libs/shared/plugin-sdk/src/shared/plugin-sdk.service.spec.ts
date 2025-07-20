import { Test, TestingModule } from '@nestjs/testing';
import { Shared/pluginSdkService } from './shared/plugin-sdk.service';

describe('Shared/pluginSdkService', () => {
  let service: Shared/pluginSdkService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Shared/pluginSdkService],
    }).compile();

    service = module.get<Shared/pluginSdkService>(Shared/pluginSdkService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
