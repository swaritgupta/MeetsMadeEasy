import { Process, Processor, InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import { DIARISATION_QUEUE, PROCESS_DIARISATION_JOB, MERGE_QUEUE, PROCESS_MERGE_JOB } from './queue-constants';
import { DiarisationService } from '../diarisation/diarisation.service';
import { AudioJobStateService } from './audio-job-state.service';

interface DiarisationJobPayload{
  filePath: string;
  jobKey: string;
}

type TranscriptSeg = {text: string, start: number, end: number};

@Processor(DIARISATION_QUEUE)
export class DiarisationProcessor{
  constructor(
    private readonly diarisationService: DiarisationService,
    private readonly jobState: AudioJobStateService,
    @InjectQueue(MERGE_QUEUE)
    private readonly mergeQueue: Queue
  ){}

  @Process(PROCESS_DIARISATION_JOB)
  async handleDiarisation(job: Job<DiarisationJobPayload>){
    const { filePath, jobKey } = job.data;
    const diarisation = await this.diarisationService.diariseAudio(filePath);
    const segments = diarisation?.segments;
    if (Array.isArray(segments)) {
      await this.jobState.storeDiarisation(jobKey, segments);
    }
    const transcription = await this.jobState.getTranscription<TranscriptSeg[]>(jobKey);
    if (Array.isArray(transcription)) {
      await this.tryEnqueueMerge(jobKey);
    }
    return;
  }

  private async tryEnqueueMerge(jobKey: string): Promise<void> {
    try {
      await this.mergeQueue.add(
        PROCESS_MERGE_JOB,
        { jobKey },
        { jobId: `merge:${jobKey}`, attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
      );
    } catch {
      // Ignore duplicate merge jobs.
    }
  }
}
