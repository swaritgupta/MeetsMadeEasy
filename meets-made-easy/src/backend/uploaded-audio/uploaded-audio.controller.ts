import { UploadedAudioService } from './uploaded-audio.service';
import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'node:path';
import { randomUUID } from 'crypto';
import { StageTypes } from '../types/stage.enum';
import { AudioJobService } from '../utilities/AudioJobService';
import { StatusTypes } from '../types/status.enum';
import { AudioJobStateService } from '../queues/audio-job-state.service';

@Controller('/api/v1.0/uploaded-audio')
export class UploadedAudioController {
  constructor(
    private readonly uploadedAudioService: UploadedAudioService,
    private readonly audioJobService: AudioJobService,
    private readonly audioJobStateService: AudioJobStateService,
  ) {}

  @Post('/upload')
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: diskStorage({
        destination: join(__dirname, '../..', 'data'),
        filename: (req, file, callback) => {
          const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, uniqueName + extname(file.originalname));
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowedTypes = [
          'audio/mpeg',
          'audio/wav',
          'audio/ogg',
          'audio/mp4',
          'audio/mp3',
        ];
        if (!allowedTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException('Unsupported file type'),
            false,
          );
        }
        callback(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadAudio(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const requestUser = (req as any).user as { googleId?: string } | undefined;
    const session = (req as any).session as
      | { googleId?: string; userId?: string }
      | undefined;
    const googleId = requestUser?.googleId ?? session?.googleId ?? session?.userId;
    if (!googleId) {
      throw new UnauthorizedException('Authentication required');
    }

    const jobKey = randomUUID();
    const audioJob = await this.audioJobService.createJob({
      jobKey,
      googleId,
      status: StatusTypes.QUEUED,
      currentStage: StageTypes.AUDIO_PROCESSING,
      stageStatuses: {
        [StageTypes.AUDIO_PROCESSING]: StatusTypes.QUEUED,
      },
    });

    try {
      await this.uploadedAudioService.enqueueAudioFile(file, googleId, jobKey);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to enqueue audio job';
      await this.audioJobService.markFailed(
        jobKey,
        StageTypes.AUDIO_PROCESSING,
        message,
      );
      throw error;
    }

    return res.status(202).json({
      message: 'Audio file accepted for processing',
      job: this.audioJobService.toContract(audioJob),
    });
  }

  @Get('/jobs/:jobKey')
  async getJobStatus(@Param('jobKey') jobKey: string) {
    const job = await this.audioJobService.findByJobKey(jobKey);
    if (!job) {
      throw new NotFoundException(`No audio job found for jobKey: ${jobKey}`);
    }

    return this.audioJobService.toContract(job);
  }

  @Get('/jobs/:jobKey/artifacts')
  async getJobArtifacts(@Param('jobKey') jobKey: string) {
    const job = await this.audioJobService.findByJobKey(jobKey);
    if (!job) {
      throw new NotFoundException(`No audio job found for jobKey: ${jobKey}`);
    }

    const artifacts = await this.audioJobStateService.getArtifacts(jobKey);
    return {
      jobKey,
      artifacts: this.audioJobService.toContract(job).artifacts,
      transcription: artifacts?.transcription ?? null,
      diarisation: artifacts?.diarisation ?? null,
      mergedConversation: artifacts?.mergedConversation ?? null,
      updatedAt: artifacts?.updatedAt ?? null,
    };
  }
}
