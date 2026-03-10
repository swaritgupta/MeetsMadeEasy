import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LiveAudioModule } from '../live-audio/live-audio.module';
import { UploadedAudioModule } from '../uploaded-audio/uploaded-audio.module';

@Module({
  imports: [
    UploadedAudioModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
