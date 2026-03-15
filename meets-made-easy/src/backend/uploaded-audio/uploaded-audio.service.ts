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
import { randomUUID } from 'crypto';
import { OpenAI } from 'openai';
import { OpenAIClient } from '../utilities/OpenAIClient';
import whisper from 'whisper-node';
type DiarSeg = {speaker: string, start: number, end: number};
type TranscriptSeg = {text: string, start: number, end: number};
type Merged = {speaker: string, word: string, start: number, end: number};
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
    if(!file){
      console.log('no file found')
    }
    const jobKey = randomUUID();
    return this.audioQueue.add(
      PROCESS_AUDIO_JOB,
      { filePath: file.path,
        jobKey,
        file: file,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async transcribeAudio(filePath: string): Promise<TranscriptSeg[]>{
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
        throw new Error(
          'ffmpeg is required to transcode audio to WAV 16k. Please install ffmpeg and try again.',
        );
      }
      const transcription = await whisper(wavPath, {
        modelName: 'medium.en',
        whisperOptions: {
          language: 'en',
          word_timestamps: true, // enables word-level timing
          condition_on_previous_text: false, // prevents hallucination loops
          no_speech_threshold: 0.6, // skip segments that are likely silence/noise
          logprob_threshold: -1.0, // reject low-confidence segments
          compression_ratio_threshold: 2.4,
          temperature: 0, // 0 = greedy, most deterministic output
          beam_size: 5, // higher = more accurate, slower
          best_of: 5,
        },
      });
      if (!Array.isArray(transcription)) {
        throw new Error('Transcription failed to return segments.');
      }
      const transcript = transcription.map((segment) => ({
        text: String(segment.speech ?? '').trim(),
        start: this.parseTimestampToSeconds(String(segment.start ?? '0:00:00.000')),
        end: this.parseTimestampToSeconds(String(segment.end ?? '0:00:00.000')),
      })).filter(seg => seg.text.length > 0 && seg.end > seg.start);
      console.log("after result")
      return transcript;
    }catch(error){
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("transcription failed");
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

  async mergeTranscriptionDiarisation(diar: DiarSeg[], transcript: TranscriptSeg[]){
    const merged: Merged[] = [];
    for(const seg of transcript){
      const speaker = this.findSpeakerForSegment(seg, diar);
      const last = merged[merged.length-1];
      if(last && last.speaker===speaker){
        last.word += ` ${seg.text}`;
        last.end = seg.end;
      }
      else{
        merged.push({
          speaker,
          word: seg.text,
          start: seg.start,
          end: seg.end
        });
      }
    }
    return merged;
  }

  private parseTimestampToSeconds(ts: string): number {
    const parts = ts.split(':');
    if (parts.length < 2) {
      const fallback = Number(ts);
      return Number.isFinite(fallback) ? fallback : 0;
    }
    const [hoursStr, minutesStr, secondsStr] = parts.length === 3 ? parts : ['0', parts[0], parts[1]];
    const hours = Number(hoursStr);
    const minutes = Number(minutesStr);
    const seconds = Number(secondsStr);
    const h = Number.isFinite(hours) ? hours : 0;
    const m = Number.isFinite(minutes) ? minutes : 0;
    const s = Number.isFinite(seconds) ? seconds : 0;
    return (h * 3600) + (m * 60) + s;
  }

  private findSpeakerForSegment(seg: TranscriptSeg, diar: DiarSeg[]): string {
    let bestSpeaker = 'unknown';
    let bestOverlap = 0;
    for (const d of diar) {
      const overlap = Math.max(0, Math.min(seg.end, d.end) - Math.max(seg.start, d.start));
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestSpeaker = d.speaker;
      }
    }
    return bestSpeaker;
  }
}
