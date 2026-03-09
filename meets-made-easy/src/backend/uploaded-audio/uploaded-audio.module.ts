import { Module } from '@nestjs/common';
import { UploadedAudioService } from './uploaded-audio.service';
import { UploadedAudioController } from './uploaded-audio.controller';

@Module({
  controllers: [UploadedAudioController],
  providers: [UploadedAudioService],
})
export class UploadedAudioModule {}
