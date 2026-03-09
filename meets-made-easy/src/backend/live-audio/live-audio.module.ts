import { Module } from '@nestjs/common';
import { LiveAudioService } from './live-audio.service';
import { LiveAudioGateway } from './live-audio.gateway';

@Module({
  providers: [LiveAudioGateway, LiveAudioService],
})
export class LiveAudioModule {}
