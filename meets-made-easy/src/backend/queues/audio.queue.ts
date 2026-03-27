import { Process, Processor, InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import {
  AUDIO_PROCESSING_QUEUE,
  PROCESS_AUDIO_JOB,
  TRANSCRIPTION_QUEUE,
  PROCESS_TRANSCRIPTION_JOB,
  DIARISATION_QUEUE,
  PROCESS_DIARISATION_JOB,
} from './queue-constants';
import { AudioJobService } from '../utilities/AudioJobService';
import { StageTypes } from '../types/stage.enum';

interface AudioJobPayload {
  filePath: string;
  jobKey: string;
  googleId?: string;
}

@Processor(AUDIO_PROCESSING_QUEUE)
export class AudioProcessor {
  constructor(
    @InjectQueue(TRANSCRIPTION_QUEUE)
    private readonly transcriptionQueue: Queue,
    @InjectQueue(DIARISATION_QUEUE)
    private readonly diarisationQueue: Queue,
    private readonly audioJobService: AudioJobService,
  ) {}

  @Process(PROCESS_AUDIO_JOB)
  async handleAudioJob(job: Job<AudioJobPayload>) {
    const { filePath, jobKey, googleId } = job.data;
    console.log('Audio job is being processed');

    await this.audioJobService.markStageProcessing(
      jobKey,
      StageTypes.AUDIO_PROCESSING,
    );

    try {
      await Promise.all([
        this.transcriptionQueue.add(
          PROCESS_TRANSCRIPTION_JOB,
          { filePath, jobKey, googleId },
          { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
        ),
        this.diarisationQueue.add(
          PROCESS_DIARISATION_JOB,
          { filePath, jobKey, googleId },
          { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
        ),
      ]);

      await this.audioJobService.markStageCompleted(
        jobKey,
        StageTypes.AUDIO_PROCESSING,
      );
      await this.audioJobService.markStageQueued(
        jobKey,
        StageTypes.TRANSCRIPTION,
      );
      await this.audioJobService.markStageQueued(
        jobKey,
        StageTypes.DIARISATION,
        false,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fan out audio job';
      await this.audioJobService.markFailed(
        jobKey,
        StageTypes.AUDIO_PROCESSING,
        message,
      );
      throw error;
    }

    return;
  }
}
