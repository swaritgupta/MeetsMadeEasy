import { Process, Processor } from '@nestjs/bull';
import { UploadedAudioService } from '../uploaded-audio/uploaded-audio.service';
import { AUDIO_PROCESSING_QUEUE, PROCESS_AUDIO_JOB } from './queue-constants';

@Processor(AUDIO_PROCESSING_QUEUE)
export class AudioProcessor{
  constructor(private readonly uploadedAudioService: UploadedAudioService){}

  @Process(PROCESS_AUDIO_JOB)
  async handleAudioJob(file: Express.Multer.File){
    return await this.uploadedAudioService.receiveAudioFile(file);
  }
}