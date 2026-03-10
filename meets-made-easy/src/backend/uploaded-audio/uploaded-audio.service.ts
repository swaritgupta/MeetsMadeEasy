import { Injectable } from '@nestjs/common';
import fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import type { Express } from 'express';
import { AUDIO_PROCESSING_QUEUE,PROCESS_AUDIO_JOB} from '../queues/queue-constants';
import { OpenAI } from 'openai';
import { OpenAIClient } from '../utilities/OpenAIClient';
import whisper from 'whisper-node';
@Injectable()
export class UploadedAudioService {
  //private readonly openAI = new OpenAIClient();
  private readonly execFileAsync = promisify(execFile);

  constructor(
    @InjectQueue(AUDIO_PROCESSING_QUEUE)
    private readonly audioQueue: Queue,
  ){}
  async enqueueAudioFile(file: Express.Multer.File){
    console.log('File is being processed')
    return this.audioQueue.add(
      PROCESS_AUDIO_JOB,
      { filePath: file.path },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async transcribeAudio(filePath: string){
    console.log('IM HERE')
    if(!filePath){
      console.log('IM NOT HERE')
      throw new Error('Audio file is required!')
    }
    let tmpDir: string | null = null;
    try{
      console.log("In transcribe audio")
      if (!fs.existsSync(filePath)) {
        throw new Error(`Audio file not found at path: ${filePath}`);
      }
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mme-audio-'));
      const baseName = path.basename(filePath, path.extname(filePath));
      const wavPath = path.join(tmpDir, `${baseName}-16k.wav`);
      try {
        await this.execFileAsync('ffmpeg', [
          '-y',
          '-i',
          filePath,
          '-ar',
          '16000',
          '-ac',
          '1',
          wavPath,
        ]);
      } catch (err) {
        throw new Error('ffmpeg is required to transcode audio to WAV 16k. Please install ffmpeg and try again.');
      }
      const transcribtion =  await whisper(wavPath, {
        modelName: 'base.en', 
      });
      const result = transcribtion.map(segment => segment.speech).join(' ');
      console.log(result)
      console.log("after result")
      return;
    }catch(error){
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Transcribtion failed");
    } finally {
      // Best-effort cleanup of temp wav and directory.
      try {
        if (tmpDir) {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      } catch {
        // Ignore cleanup errors.
      }
    }
  }
}
