import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { MERGE_QUEUE, PROCESS_MERGE_JOB } from './queue-constants';
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
    private readonly jobState: AudioJobStateService
  ){}

  @Process(PROCESS_MERGE_JOB)
  async handleMerge(job: Job<MergeJobPayload>){
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
    await this.jobState.cleanup(jobKey);
    return;
  }
}
