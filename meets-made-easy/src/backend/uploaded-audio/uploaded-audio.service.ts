import { Injectable } from '@nestjs/common';

@Injectable()
export class UploadedAudioService {
  async receiveAudioFile(file: Express.Multer.File){
    console.log('File is being processed')
    return;
  }
}
