import { Process, Processor } from '@nestjs/bull';
import { UploadedAudioService } from '../uploaded-audio/uploaded-audio.service';
import { AUDIO_PROCESSING_QUEUE, PROCESS_AUDIO_JOB } from './queue-constants';
import type { Job } from 'bull';

interface AudioJobPayload{
  filePath: string;
}
@Processor(AUDIO_PROCESSING_QUEUE)
export class AudioProcessor{
  constructor(private readonly uploadedAudioService: UploadedAudioService){}

  @Process(PROCESS_AUDIO_JOB)
  async handleAudioJob(job: Job<AudioJobPayload>){
    const filePath = job.data.filePath;
    console.log("File is getting processed");
    await this.uploadedAudioService.transcribeAudio(filePath);
    return;
  }
}
