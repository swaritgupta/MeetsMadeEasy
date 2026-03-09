import { WebSocketGateway } from '@nestjs/websockets';
import { LiveAudioService } from './live-audio.service';

@WebSocketGateway()
export class LiveAudioGateway {
  constructor(private readonly liveAudioService: LiveAudioService) {}
}
