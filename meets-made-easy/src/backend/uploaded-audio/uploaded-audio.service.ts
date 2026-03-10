import { Injectable } from '@nestjs/common';
import fs from 'fs';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { AUDIO_PROCESSING_QUEUE,PROCESS_AUDIO_JOB} from '../queues/queue-constants';

@Injectable()
export class UploadedAudioService {

  constructor(
    @InjectQueue(AUDIO_PROCESSING_QUEUE)
    private readonly audioQueue: Queue,
  ){}
  async enqueueAudioFile(file: Express.Multer.File){
    console.log('File is being processed')
    return this.audioQueue.add(
      PROCESS_AUDIO_JOB,
      { file },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
