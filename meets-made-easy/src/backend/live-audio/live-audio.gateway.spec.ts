import { Test, TestingModule } from '@nestjs/testing';
import { LiveAudioGateway } from './live-audio.gateway';
import { LiveAudioService } from './live-audio.service';

describe('LiveAudioGateway', () => {
  let gateway: LiveAudioGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LiveAudioGateway, LiveAudioService],
    }).compile();

    gateway = module.get<LiveAudioGateway>(LiveAudioGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
