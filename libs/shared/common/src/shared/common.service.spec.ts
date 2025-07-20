import { Test, TestingModule } from '@nestjs/testing';
import { Shared/commonService } from './shared/common.service';

describe('Shared/commonService', () => {
  let service: Shared/commonService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Shared/commonService],
    }).compile();

    service = module.get<Shared/commonService>(Shared/commonService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
