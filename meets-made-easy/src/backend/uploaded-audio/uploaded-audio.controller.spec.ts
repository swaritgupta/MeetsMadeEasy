import { Test, TestingModule } from '@nestjs/testing';
import { UploadedAudioController } from './uploaded-audio.controller';
import { UploadedAudioService } from './uploaded-audio.service';

describe('UploadedAudioController', () => {
  let controller: UploadedAudioController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadedAudioController],
      providers: [UploadedAudioService],
    }).compile();

    controller = module.get<UploadedAudioController>(UploadedAudioController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
