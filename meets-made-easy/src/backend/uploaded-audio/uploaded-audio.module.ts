import { Module } from '@nestjs/common';
import { UploadedAudioService } from './uploaded-audio.service';
import { UploadedAudioController } from './uploaded-audio.controller';
import { BullModule } from '@nestjs/bull';
import { AUDIO_PROCESSING_QUEUE } from '../queues/queue-constants';
import { AudioProcessor } from '../queues/audio.queue';
import { DiarisationService } from '../diarisation/diarisation.service';
import { HttpUtilModule } from '../utilities/http-util.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: AUDIO_PROCESSING_QUEUE,
    }),
    HttpUtilModule,
  ],
  controllers: [UploadedAudioController],
  providers: [UploadedAudioService, AudioProcessor, DiarisationService],
})
export class UploadedAudioModule {}
