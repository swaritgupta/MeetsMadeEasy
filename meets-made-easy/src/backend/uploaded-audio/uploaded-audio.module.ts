import { Module } from '@nestjs/common';
import { UploadedAudioService } from './uploaded-audio.service';
import { UploadedAudioController } from './uploaded-audio.controller';
import { BullModule } from '@nestjs/bull';
import { AUDIO_PROCESSING_QUEUE, TRANSCRIPTION_QUEUE, DIARISATION_QUEUE, MERGE_QUEUE, LLM_QUEUE, EMAIL_QUEUE, ACTION_QUEUE } from '../queues/queue-constants';
import { AudioProcessor } from '../queues/audio.queue';
import { TranscriptionProcessor } from '../queues/transcription.queue';
import { DiarisationProcessor } from '../queues/diarisation.queue';
import { MergeProcessor } from '../queues/merge.queue';
import { LlmQueue } from '../queues/llm.queue';
import { DiarisationService } from '../diarisation/diarisation.service';
import { HttpUtilModule } from '../utilities/http-util.module';
import { AudioJobStateService } from '../queues/audio-job-state.service';
import { LlmModule } from '../llm/llm.module';
import { ActionQueue } from '../queues/actions.queue';
import { EmailProcessor } from '../queues/email.queue';

@Module({
  imports: [
    BullModule.registerQueue({
      name: AUDIO_PROCESSING_QUEUE,
    }),
    BullModule.registerQueue({
      name: TRANSCRIPTION_QUEUE,
    }),
    BullModule.registerQueue({
      name: DIARISATION_QUEUE,
    }),
    BullModule.registerQueue({
      name: MERGE_QUEUE,
    }),
    BullModule.registerQueue({
      name: LLM_QUEUE,
    }),
    BullModule.registerQueue({
      name: ACTION_QUEUE,
    }),
    BullModule.registerQueue({
      name: EMAIL_QUEUE,
    }),
    
    HttpUtilModule,
    LlmModule,
  ],
  controllers: [UploadedAudioController],
  providers: [
    UploadedAudioService,
    AudioProcessor,
    TranscriptionProcessor,
    DiarisationProcessor,
    MergeProcessor,
    LlmQueue,
    AudioJobStateService,
    DiarisationService,
    EmailProcessor,
    ActionQueue,
  ],
})
export class UploadedAudioModule {}
