import { Controller } from '@nestjs/common';
import { UploadedAudioService } from './uploaded-audio.service';

@Controller('uploaded-audio')
export class UploadedAudioController {
  constructor(private readonly uploadedAudioService: UploadedAudioService) {}
}
