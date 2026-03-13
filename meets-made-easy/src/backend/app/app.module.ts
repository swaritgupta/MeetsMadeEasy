import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LiveAudioModule } from '../live-audio/live-audio.module';
import { UploadedAudioModule } from '../uploaded-audio/uploaded-audio.module';
import { BullModule } from '@nestjs/bull';
import { HttpUtilModule } from '../utilities/http-util.module';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    UploadedAudioModule,
    HttpUtilModule,
    
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
