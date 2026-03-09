import { Test, TestingModule } from '@nestjs/testing';
import { LiveAudioService } from './live-audio.service';

describe('LiveAudioService', () => {
  let service: LiveAudioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LiveAudioService],
    }).compile();

    service = module.get<LiveAudioService>(LiveAudioService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
