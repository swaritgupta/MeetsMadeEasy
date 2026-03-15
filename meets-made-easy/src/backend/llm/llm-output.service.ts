import { Injectable } from '@nestjs/common';
import fs from 'fs';
import path from 'path';

@Injectable()
export class LlmOutputService {
  private readonly outputDir = path.join(process.cwd(), 'src', 'backend', 'llm', 'outputs');

  private ensureDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async save(jobKey: string, payload: unknown): Promise<string> {
    this.ensureDir();
    const safeJobKey = jobKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(this.outputDir, `${safeJobKey}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return filePath;
  }
}
