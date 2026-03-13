import { Process, Processor } from '@nestjs/bull';
import { UploadedAudioService } from '../uploaded-audio/uploaded-audio.service';
import { AUDIO_PROCESSING_QUEUE, PROCESS_AUDIO_JOB } from './queue-constants';
import type { Job } from 'bull';
import { DiarisationService } from '../diarisation/diarisation.service';

interface AudioJobPayload{
  filePath: string;
}
@Processor(AUDIO_PROCESSING_QUEUE)
export class AudioProcessor{
  constructor(
    private readonly uploadedAudioService: UploadedAudioService, 
    private readonly diarisationService: DiarisationService
  ){}

  @Process(PROCESS_AUDIO_JOB)
  async handleAudioJob(job: Job<AudioJobPayload>){
    const filePath = job.data.filePath;
    console.log("File is getting processed");
    // await this.uploadedAudioService.transcribeAudio(filePath);
    // const diarisation = await this.diarisationService.diariseAudio(filePath);
    const [transcription, diarisation] = await Promise.all([
      this.uploadedAudioService.transcribeAudio(filePath),
      this.diarisationService.diariseAudio(filePath)
    ])
    const count = Array.isArray(diarisation?.segments) ? diarisation.segments.length : 0;
    console.log(`Diarisation complete. segments=${count}`);
    console.log(diarisation.segments);
    return;
  }

}
