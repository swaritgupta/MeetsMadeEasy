import { Test, TestingModule } from '@nestjs/testing';
import { DiarisationService } from './diarisation.service';
import { HttpUtil } from '../utilities/HttpUtil';

describe('DiarisationService', () => {
  let service: DiarisationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiarisationService,
        {
          provide: HttpUtil,
          useValue: { post: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<DiarisationService>(DiarisationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
