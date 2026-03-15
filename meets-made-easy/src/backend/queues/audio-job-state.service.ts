import { Injectable } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import os from 'os';

@Injectable()
export class AudioJobStateService {
  private readonly rootDir = path.join(os.tmpdir(), 'mme-audio-jobs');

  private ensureJobDir(jobKey: string): string {
    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir, { recursive: true });
    }
    const dir = path.join(this.rootDir, jobKey);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private async writeJson(filePath: string, payload: unknown): Promise<void> {
    await fs.promises.writeFile(filePath, JSON.stringify(payload), 'utf8');
  }

  private async readJson<T>(filePath: string): Promise<T | null> {
    try {
      const raw = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async storeTranscription(jobKey: string, transcription: unknown): Promise<void> {
    const dir = this.ensureJobDir(jobKey);
    await this.writeJson(path.join(dir, 'transcription.json'), transcription);
  }

  async storeDiarisation(jobKey: string, diarisation: unknown): Promise<void> {
    const dir = this.ensureJobDir(jobKey);
    await this.writeJson(path.join(dir, 'diarisation.json'), diarisation);
  }

  async getTranscription<T>(jobKey: string): Promise<T | null> {
    const filePath = path.join(this.rootDir, jobKey, 'transcription.json');
    return this.readJson<T>(filePath);
  }

  async getDiarisation<T>(jobKey: string): Promise<T | null> {
    const filePath = path.join(this.rootDir, jobKey, 'diarisation.json');
    return this.readJson<T>(filePath);
  }

  async cleanup(jobKey: string): Promise<void> {
    const dir = path.join(this.rootDir, jobKey);
    try {
      await fs.promises.rm(dir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup.
    }
  }
}
