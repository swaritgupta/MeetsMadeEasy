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

interface AudioJobPayload {
  filePath: string;
  jobKey: string;
}

@Processor(AUDIO_PROCESSING_QUEUE)
export class AudioProcessor {
  constructor(
    @InjectQueue(TRANSCRIPTION_QUEUE)
    private readonly transcriptionQueue: Queue,
    @InjectQueue(DIARISATION_QUEUE)
    private readonly diarisationQueue: Queue,
  ) {}

  @Process(PROCESS_AUDIO_JOB)
  async handleAudioJob(job: Job<AudioJobPayload>) {
    const { filePath, jobKey } = job.data;
    console.log('Audio job is being processed');
    await Promise.all([
      this.transcriptionQueue.add(
        PROCESS_TRANSCRIPTION_JOB,
        { filePath, jobKey },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      ),
      this.diarisationQueue.add(
        PROCESS_DIARISATION_JOB,
        { filePath, jobKey },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      ),
    ]);
    return;
  }
}
