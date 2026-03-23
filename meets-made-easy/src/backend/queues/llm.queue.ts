import { InjectQueue, Process, Processor } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import { ACTION_QUEUE, LLM_QUEUE, PROCESS_ACTION_JOB, PROCESS_LLM_JOB } from './queue-constants';
import { LlmService } from '../llm/llm.service';
import { LlmOutputService } from '../llm/llm-output.service';

type Merged = { speaker: string; word: string; start: number; end: number };

interface LlmJobPayload {
  jobKey: string;
  conv: Merged[];
}

@Processor(LLM_QUEUE)
export class LlmQueue {
  constructor(
    private readonly llmService: LlmService,
    private readonly llmOutput: LlmOutputService,
    @InjectQueue(ACTION_QUEUE)
    private readonly actionQueue: Queue,
  ) {}

  @Process(PROCESS_LLM_JOB)
  async handleLLMJob(job: Job<LlmJobPayload>) {
    console.log("LLM job is being processed");
    const { conv, jobKey } = job.data;
    const result = await this.llmService.generateAnswer(conv);
    const savedPath = await this.llmOutput.save(jobKey, result);
    const record = await this.llmOutput.saveToDb(jobKey, result);
    console.log("LLM job completed");
    if (!result.parsed) {
      console.warn(`LLM response for ${jobKey} could not be parsed: ${result.parseError}`);
    }
    // After saving the LLM result:
    console.log("Enqueuing action job");
    if (result.parsed) {
      await this.actionQueue.add(PROCESS_ACTION_JOB, {
        ...result.parsed,
        meetingId: jobKey,
      });
    }
    console.log("Action job enqueued");


    console.log(`LLM result for ${jobKey} saved to: ${savedPath} (db id: ${record.id})`);
    return result;
  }
}
