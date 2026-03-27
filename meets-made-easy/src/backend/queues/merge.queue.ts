import { Process, Processor, InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import {
  MERGE_QUEUE,
  PROCESS_MERGE_JOB,
  LLM_QUEUE,
  PROCESS_LLM_JOB,
} from './queue-constants';
import { UploadedAudioService } from '../uploaded-audio/uploaded-audio.service';
import { AudioJobStateService } from './audio-job-state.service';
import { AudioJobService } from '../utilities/AudioJobService';
import { StageTypes } from '../types/stage.enum';

interface MergeJobPayload {
  jobKey: string;
  googleId?: string;
}

type DiarSeg = { speaker: string; start: number; end: number };
type TranscriptSeg = { text: string; start: number; end: number };

@Processor(MERGE_QUEUE)
export class MergeProcessor {
  constructor(
    private readonly uploadedAudioService: UploadedAudioService,
    private readonly jobState: AudioJobStateService,
    private readonly audioJobService: AudioJobService,
    @InjectQueue(LLM_QUEUE)
    private readonly llmQueue: Queue,
  ) {}

  @Process(PROCESS_MERGE_JOB)
  async handleMerge(job: Job<MergeJobPayload>) {
    console.log('Merge job is being processed');
    const { jobKey, googleId } = job.data;
    try {
      await this.audioJobService.markStageProcessing(jobKey, StageTypes.MERGE);

      const [diarisation, transcription] = await Promise.all([
        this.jobState.getDiarisation<DiarSeg[]>(jobKey),
        this.jobState.getTranscription<TranscriptSeg[]>(jobKey),
      ]);

      if (!Array.isArray(diarisation) || !Array.isArray(transcription)) {
        throw new Error(
          'Merge stage requires both transcription and diarisation artifacts',
        );
      }

      const convSegment =
        await this.uploadedAudioService.mergeTranscriptionDiarisation(
          diarisation,
          transcription,
        );
      console.log(convSegment);
      await this.jobState.storeMergedConversation(jobKey, convSegment);
      await this.audioJobService.markArtifactReady(jobKey, 'mergedConversation');

      await this.audioJobService.markStageCompleted(jobKey, StageTypes.MERGE);
      await this.llmQueue.add(
        PROCESS_LLM_JOB,
        { jobKey, googleId },
        { attempts: 2, backoff: { type: 'exponential', delay: 2000 } },
      );
      await this.audioJobService.markStageQueued(jobKey, StageTypes.LLM);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Merge stage failed';
      console.error('Failed during merge stage', error);
      await this.audioJobService.markFailed(jobKey, StageTypes.MERGE, message);
      throw error;
    }

    return;
  }
}
