import { Process, Processor, InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import {
  TRANSCRIPTION_QUEUE,
  PROCESS_TRANSCRIPTION_JOB,
  MERGE_QUEUE,
  PROCESS_MERGE_JOB,
} from './queue-constants';
import { UploadedAudioService } from '../uploaded-audio/uploaded-audio.service';
import { AudioJobStateService } from './audio-job-state.service';
import { AudioJobService } from '../utilities/AudioJobService';
import { StageTypes } from '../types/stage.enum';

interface TranscriptionJobPayload {
  filePath: string;
  jobKey: string;
  googleId?: string;
}

type DiarSeg = { speaker: string; start: number; end: number };

@Processor(TRANSCRIPTION_QUEUE)
export class TranscriptionProcessor {
  constructor(
    private readonly uploadedAudioService: UploadedAudioService,
    private readonly jobState: AudioJobStateService,
    private readonly audioJobService: AudioJobService,
    @InjectQueue(MERGE_QUEUE)
    private readonly mergeQueue: Queue,
  ) {}

  @Process(PROCESS_TRANSCRIPTION_JOB)
  async handleTranscription(job: Job<TranscriptionJobPayload>) {
    const { filePath, jobKey, googleId } = job.data;
    await this.audioJobService.markStageProcessing(
      jobKey,
      StageTypes.TRANSCRIPTION,
    );

    try {
      const transcription =
        await this.uploadedAudioService.transcribeAudio(filePath);
      await this.jobState.storeTranscription(jobKey, transcription);
      await this.audioJobService.markArtifactReady(jobKey, 'transcription');
      await this.audioJobService.markStageCompleted(
        jobKey,
        StageTypes.TRANSCRIPTION,
      );

      const diarisation = await this.jobState.getDiarisation<DiarSeg[]>(jobKey);
      if (Array.isArray(diarisation)) {
        console.log(
          'Transcription and diarisation are ready, merging them from transcription queue',
        );
        await this.audioJobService.markStageQueued(jobKey, StageTypes.MERGE);
        await this.tryEnqueueMerge(jobKey, googleId);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Transcription stage failed';
      await this.audioJobService.markFailed(
        jobKey,
        StageTypes.TRANSCRIPTION,
        message,
      );
      throw error;
    }

    return;
  }

  private async tryEnqueueMerge(
    jobKey: string,
    googleId?: string,
  ): Promise<void> {
    try {
      await this.mergeQueue.add(
        PROCESS_MERGE_JOB,
        { jobKey, googleId },
        {
          jobId: `merge:${jobKey}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
    } catch {
      // Ignore duplicate merge jobs.
    }
  }
}
