import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { LlmOutputService } from './llm-output.service';

@Controller('llm')
export class LlmController {
  constructor(private readonly llmOutputService: LlmOutputService) {}

  @Get('output/:jobKey')
  async getLatestOutput(@Param('jobKey') jobKey: string) {
    const record = await this.llmOutputService.findLatestByJobKey(jobKey);
    if (!record) {
      throw new NotFoundException(`No LLM output found for jobKey: ${jobKey}`);
    }

    return {
      id: record.id,
      jobKey: record.jobKey,
      model: record.model ?? null,
      answer: record.answer ?? null,
      summary: record.summary ?? null,
      actionItems: record.actionItems ?? [],
      parsed: record.parsed ?? null,
      parseError: record.parseError ?? null,
      usedRetry: record.usedRetry ?? false,
      createdAt: record.createdAt ?? null,
    };
  }

  @Get('output/:jobKey/action-items')
  async getLatestActionItems(@Param('jobKey') jobKey: string) {
    const record = await this.llmOutputService.findLatestByJobKey(jobKey);
    if (!record) {
      throw new NotFoundException(`No LLM output found for jobKey: ${jobKey}`);
    }

    return {
      jobKey: record.jobKey,
      summary: record.summary ?? null,
      actionItems: record.actionItems ?? [],
      parseError: record.parseError ?? null,
      usedRetry: record.usedRetry ?? false,
      createdAt: record.createdAt ?? null,
    };
  }
}
