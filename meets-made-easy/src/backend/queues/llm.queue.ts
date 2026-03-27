import { InjectQueue, Process, Processor } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import {
  ACTION_QUEUE,
  LLM_QUEUE,
  PROCESS_ACTION_JOB,
  PROCESS_LLM_JOB,
} from './queue-constants';
import { LlmService } from '../llm/llm.service';
import { LlmOutputService } from '../llm/llm-output.service';
import { AudioJobService } from '../utilities/AudioJobService';
import { StageTypes } from '../types/stage.enum';
import { AudioJobStateService } from './audio-job-state.service';

type Merged = { speaker: string; word: string; start: number; end: number };

interface LlmJobPayload {
  jobKey: string;
  googleId?: string;
}

@Processor(LLM_QUEUE)
export class LlmQueue {
  constructor(
    private readonly llmService: LlmService,
    private readonly llmOutput: LlmOutputService,
    private readonly audioJobService: AudioJobService,
    private readonly jobState: AudioJobStateService,
    @InjectQueue(ACTION_QUEUE)
    private readonly actionQueue: Queue,
  ) {}

  @Process(PROCESS_LLM_JOB)
  async handleLLMJob(job: Job<LlmJobPayload>) {
    console.log('LLM job is being processed');
    const { jobKey, googleId } = job.data;
    await this.audioJobService.markStageProcessing(jobKey, StageTypes.LLM);

    try {
      const conv = await this.jobState.getMergedConversation<Merged[]>(jobKey);
      if (!Array.isArray(conv)) {
        throw new Error('LLM stage requires a merged conversation artifact');
      }

      const result = await this.llmService.generateAnswer(conv);
      const savedPath = await this.llmOutput.save(jobKey, result);
      const record = await this.llmOutput.saveToDb(jobKey, result, googleId);
      await this.audioJobService.attachLlmOutput(jobKey, String(record.id));
      console.log('LLM job completed');
      if (!result.parsed) {
        console.warn(
          `LLM response for ${jobKey} could not be parsed: ${result.parseError}`,
        );
      }

      await this.audioJobService.markStageCompleted(jobKey, StageTypes.LLM);

      console.log('Enqueuing action job');
      if (result.parsed) {
        await this.actionQueue.add(PROCESS_ACTION_JOB, {
          ...result.parsed,
          meetingId: jobKey,
          googleId,
        });
        await this.audioJobService.markStageQueued(jobKey, StageTypes.ACTIONS);
      } else {
        await this.audioJobService.markCompleted(jobKey, StageTypes.LLM);
      }
      console.log('Action job enqueued');

      console.log(
        `LLM result for ${jobKey} saved to: ${savedPath} (db id: ${record.id})`,
      );
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'LLM stage failed';
      await this.audioJobService.markFailed(jobKey, StageTypes.LLM, message);
      throw error;
    }
  }
}
