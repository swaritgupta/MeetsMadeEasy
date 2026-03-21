import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import fs from 'fs';
import path from 'path';
import { Model } from 'mongoose';
import {
  LlmAnswerResult,
  MeetingActionItem,
  MeetingSummaryOutput,
} from './llm.service';
import { LlmOutput, LlmOutputDocument } from './schemas/llm-output.schema';

@Injectable()
export class LlmOutputService {
  private readonly outputDir = path.join(process.cwd(), 'src', 'backend', 'llm', 'outputs');

  constructor(
    @InjectModel(LlmOutput.name)
    private readonly llmOutputModel: Model<LlmOutputDocument>,
  ) {}

  private ensureDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async save(jobKey: string, payload: unknown): Promise<string> {
    this.ensureDir();

    // Keep filenames safe even if the queue key contains spaces or punctuation.
    const safeJobKey = jobKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(this.outputDir, `${safeJobKey}.json`);

    await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return filePath;
  }

  async findLatestByJobKey(jobKey: string): Promise<LlmOutputDocument | null> {
    return this.llmOutputModel.findOne({ jobKey }).sort({ createdAt: -1 }).exec();
  }

  async saveToDb(jobKey: string, payload: LlmAnswerResult): Promise<LlmOutputDocument> {
    const parsed = payload.parsed ?? null;

    return this.llmOutputModel.create({
      jobKey,
      model: payload.model,
      answer: payload.answer,
      parsed,
      summary: this.extractSummary(parsed),
      actionItems: this.extractActionItems(parsed),
      parseError: payload.parseError,
      usedRetry: payload.usedRetry,
      payload,
    });
  }

  private extractSummary(parsed: MeetingSummaryOutput | null): string | undefined {
    return parsed?.summary || undefined;
  }

  private extractActionItems(parsed: MeetingSummaryOutput | null): MeetingActionItem[] {
    return parsed?.action_items ?? [];
  }
}
