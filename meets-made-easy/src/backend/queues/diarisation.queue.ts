import { Process, Processor, InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import {
  DIARISATION_QUEUE,
  PROCESS_DIARISATION_JOB,
  MERGE_QUEUE,
  PROCESS_MERGE_JOB,
} from './queue-constants';
import { DiarisationService } from '../diarisation/diarisation.service';
import { AudioJobStateService } from './audio-job-state.service';
import { AudioJobService } from '../utilities/AudioJobService';
import { StageTypes } from '../types/stage.enum';

interface DiarisationJobPayload {
  filePath: string;
  jobKey: string;
  googleId?: string;
}

type TranscriptSeg = { text: string; start: number; end: number };

@Processor(DIARISATION_QUEUE)
export class DiarisationProcessor {
  constructor(
    private readonly diarisationService: DiarisationService,
    private readonly jobState: AudioJobStateService,
    private readonly audioJobService: AudioJobService,
    @InjectQueue(MERGE_QUEUE)
    private readonly mergeQueue: Queue,
  ) {}

  @Process(PROCESS_DIARISATION_JOB)
  async handleDiarisation(job: Job<DiarisationJobPayload>) {
    const { filePath, jobKey, googleId } = job.data;
    await this.audioJobService.markStageProcessing(
      jobKey,
      StageTypes.DIARISATION,
    );

    try {
      const diarisation = await this.diarisationService.diariseAudio(filePath);
      const segments = diarisation?.segments;
      if (Array.isArray(segments)) {
        await this.jobState.storeDiarisation(jobKey, segments);
        await this.audioJobService.markArtifactReady(jobKey, 'diarisation');
      }
      await this.audioJobService.markStageCompleted(
        jobKey,
        StageTypes.DIARISATION,
      );

      const transcription =
        await this.jobState.getTranscription<TranscriptSeg[]>(jobKey);
      if (Array.isArray(transcription)) {
        console.log(
          'Transcription and diarisation are ready, merging them from diarisation queue',
        );
        await this.audioJobService.markStageQueued(jobKey, StageTypes.MERGE);
        await this.tryEnqueueMerge(jobKey, googleId);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Diarisation stage failed';
      await this.audioJobService.markFailed(
        jobKey,
        StageTypes.DIARISATION,
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
