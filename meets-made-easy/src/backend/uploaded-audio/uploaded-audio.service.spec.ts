import { Test, TestingModule } from '@nestjs/testing';
import { UploadedAudioService } from './uploaded-audio.service';

describe('UploadedAudioService', () => {
  let service: UploadedAudioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UploadedAudioService],
    }).compile();

    service = module.get<UploadedAudioService>(UploadedAudioService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
