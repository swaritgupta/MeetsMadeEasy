import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { LLM_QUEUE, PROCESS_LLM_JOB } from './queue-constants';
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
  ) {}

  @Process(PROCESS_LLM_JOB)
  async handleLLMJob(job: Job<LlmJobPayload>) {
    const { conv, jobKey } = job.data;
    const result = await this.llmService.generateAnswer(conv);
    const savedPath = await this.llmOutput.save(jobKey, result);
    const record = await this.llmOutput.saveToDb(jobKey, result);

    if (!result.parsed) {
      console.warn(`LLM response for ${jobKey} could not be parsed: ${result.parseError}`);
    }

    console.log(`LLM result for ${jobKey} saved to: ${savedPath} (db id: ${record.id})`);
    return result;
  }
}
