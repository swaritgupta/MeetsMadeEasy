import { Process, Processor, InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import { MERGE_QUEUE, PROCESS_MERGE_JOB, LLM_QUEUE, PROCESS_LLM_JOB } from './queue-constants';
import { UploadedAudioService } from '../uploaded-audio/uploaded-audio.service';
import { AudioJobStateService } from './audio-job-state.service';

interface MergeJobPayload{
  jobKey: string;
}

type DiarSeg = {speaker: string, start: number, end: number};
type TranscriptSeg = {text: string, start: number, end: number};

@Processor(MERGE_QUEUE)
export class MergeProcessor{
  constructor(
    private readonly uploadedAudioService: UploadedAudioService,
    private readonly jobState: AudioJobStateService,
    @InjectQueue(LLM_QUEUE)
    private readonly llmQueue: Queue
  ){}

  @Process(PROCESS_MERGE_JOB)
  async handleMerge(job: Job<MergeJobPayload>){
    console.log("Merge job is being processed");
    const { jobKey } = job.data;
    const [diarisation, transcription] = await Promise.all([
      this.jobState.getDiarisation<DiarSeg[]>(jobKey),
      this.jobState.getTranscription<TranscriptSeg[]>(jobKey)
    ]);

    if (!Array.isArray(diarisation) || !Array.isArray(transcription)) {
      console.error('Error while processing audio');
      return;
    }

    const convSegment = await this.uploadedAudioService.mergeTranscriptionDiarisation(diarisation, transcription);
    console.log(convSegment);
    try {
      await this.llmQueue.add(
        PROCESS_LLM_JOB,
        { jobKey, conv: convSegment },
        { attempts: 2, backoff: { type: 'exponential', delay: 2000 } }
      );
    } catch (error) {
      console.error('Failed to enqueue LLM job', error);
    }
    await this.jobState.cleanup(jobKey);
    return;
  }
}
