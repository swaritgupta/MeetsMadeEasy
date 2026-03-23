import { Process, Processor, InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import { TRANSCRIPTION_QUEUE, PROCESS_TRANSCRIPTION_JOB, MERGE_QUEUE, PROCESS_MERGE_JOB } from './queue-constants';
import { UploadedAudioService } from '../uploaded-audio/uploaded-audio.service';
import { AudioJobStateService } from './audio-job-state.service';

interface TranscriptionJobPayload{
  filePath: string;
  jobKey: string;
}

type DiarSeg = {speaker: string, start: number, end: number};

@Processor(TRANSCRIPTION_QUEUE)
export class TranscriptionProcessor{
  constructor(
    private readonly uploadedAudioService: UploadedAudioService,
    private readonly jobState: AudioJobStateService,
    @InjectQueue(MERGE_QUEUE)
    private readonly mergeQueue: Queue
  ){}

  @Process(PROCESS_TRANSCRIPTION_JOB)
  async handleTranscription(job: Job<TranscriptionJobPayload>){
    const { filePath, jobKey } = job.data;
    const transcription = await this.uploadedAudioService.transcribeAudio(filePath);
    await this.jobState.storeTranscription(jobKey, transcription);
    const diarisation = await this.jobState.getDiarisation<DiarSeg[]>(jobKey);
    if (Array.isArray(diarisation)) {
      console.log("Transcription and diarisation are ready, merging them from transcription queue");
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
