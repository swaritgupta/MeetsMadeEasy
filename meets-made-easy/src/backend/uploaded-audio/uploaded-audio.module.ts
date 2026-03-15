import { Module } from '@nestjs/common';
import { UploadedAudioService } from './uploaded-audio.service';
import { UploadedAudioController } from './uploaded-audio.controller';
import { BullModule } from '@nestjs/bull';
import { AUDIO_PROCESSING_QUEUE, TRANSCRIPTION_QUEUE, DIARISATION_QUEUE, MERGE_QUEUE, LLM_QUEUE } from '../queues/queue-constants';
import { AudioProcessor } from '../queues/audio.queue';
import { TranscriptionProcessor } from '../queues/transcription.queue';
import { DiarisationProcessor } from '../queues/diarisation.queue';
import { MergeProcessor } from '../queues/merge.queue';
import { LlmQueue } from '../queues/llm.queue';
import { DiarisationService } from '../diarisation/diarisation.service';
import { HttpUtilModule } from '../utilities/http-util.module';
import { AudioJobStateService } from '../queues/audio-job-state.service';
import { LlmService } from '../llm/llm.service';
import { GeminiClient } from '../utilities/GeminiClient';
import { LlmOutputService } from '../llm/llm-output.service';

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
    HttpUtilModule,
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
    LlmService,
    LlmOutputService,
    GeminiClient,
    DiarisationService
  ],
})
export class UploadedAudioModule {}
