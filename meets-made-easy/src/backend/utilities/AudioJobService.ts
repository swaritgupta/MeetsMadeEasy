import { InjectModel } from '@nestjs/mongoose';
import {
  AudioJob,
  AudioJobArtifacts,
  AudioJobDocument,
} from '../schemas/audioJob.schema';
import { Model } from 'mongoose';
import { Injectable, Logger } from '@nestjs/common';
import { StageTypes } from '../types/stage.enum';
import { StatusTypes } from '../types/status.enum';

interface AudioJobEvent {
  jobKey: string;
  googleId: string;
  status: StatusTypes;
  currentStage: StageTypes;
  stageStatuses?: Partial<Record<StageTypes, StatusTypes>>;
  error?: string;
}

type ArtifactName = Exclude<keyof AudioJobArtifacts, 'llmOutputId'>;

@Injectable()
export class AudioJobService {
  private readonly logger = new Logger(AudioJobService.name);

  constructor(
    @InjectModel(AudioJob.name)
    private readonly audioJobModel: Model<AudioJobDocument>,
  ) {}

  async createJob(event: AudioJobEvent) {
    const job = new this.audioJobModel(event);
    await job.save();
    return job;
  }

  async findByJobKey(jobKey: string) {
    return this.audioJobModel.findOne({ jobKey }).exec();
  }

  async markStageQueued(jobKey: string, stage: StageTypes, setCurrentStage = true) {
    return this.updateStageStatus(jobKey, stage, StatusTypes.QUEUED, {
      setCurrentStage,
      clearError: true,
    });
  }

  async markStageProcessing(jobKey: string, stage: StageTypes) {
    return this.updateStageStatus(jobKey, stage, StatusTypes.PROCESSING, {
      setCurrentStage: true,
      overallStatus: StatusTypes.PROCESSING,
      clearError: true,
    });
  }

  async markStageCompleted(jobKey: string, stage: StageTypes, setCurrentStage = false) {
    return this.updateStageStatus(jobKey, stage, StatusTypes.COMPLETED, {
      setCurrentStage,
      clearError: true,
    });
  }

  async markCompleted(jobKey: string, stage: StageTypes) {
    return this.updateStageStatus(jobKey, stage, StatusTypes.COMPLETED, {
      setCurrentStage: true,
      overallStatus: StatusTypes.COMPLETED,
      clearError: true,
    });
  }

  async markFailed(jobKey: string, stage: StageTypes, error: string) {
    const job = await this.updateStageStatus(jobKey, stage, StatusTypes.FAILED, {
      setCurrentStage: true,
      overallStatus: StatusTypes.FAILED,
      error,
    });
    this.logger.error(`Audio job ${jobKey} failed at ${stage}: ${error}`);
    return job;
  }

  toContract(job: AudioJobDocument) {
    const stageStatuses = this.normalizeStageStatuses(job);

    return {
      jobKey: job.jobKey,
      status: job.status,
      currentStage: job.currentStage,
      stageStatuses,
      artifacts: this.normalizeArtifacts(job),
      error: job.error ?? null,
      createdAt: job.createdAt ?? null,
      updatedAt: job.updatedAt ?? null,
      statusUrl: `/api/v1.0/uploaded-audio/jobs/${job.jobKey}`,
      resultUrl: `/llm/output/${job.jobKey}`,
      artifactsUrl: `/api/v1.0/uploaded-audio/jobs/${job.jobKey}/artifacts`,
    };
  }

  async markArtifactReady(jobKey: string, artifactName: ArtifactName) {
    const job = await this.audioJobModel.findOne({ jobKey }).exec();
    if (!job) {
      throw new Error('Job not found');
    }

    job.artifacts = {
      ...this.normalizeArtifacts(job),
      [artifactName]: true,
    };
    await job.save();
    return job;
  }

  async attachLlmOutput(jobKey: string, llmOutputId: string) {
    const job = await this.audioJobModel.findOne({ jobKey }).exec();
    if (!job) {
      throw new Error('Job not found');
    }

    job.artifacts = {
      ...this.normalizeArtifacts(job),
      llmOutputId,
    };
    await job.save();
    return job;
  }

  private async updateStageStatus(
    jobKey: string,
    stage: StageTypes,
    status: StatusTypes,
    options: {
      setCurrentStage?: boolean;
      overallStatus?: StatusTypes;
      error?: string;
      clearError?: boolean;
    } = {},
  ) {
    const job = await this.audioJobModel.findOne({ jobKey }).exec();
    if (!job) {
      throw new Error('Job not found');
    }

    const stageStatuses = this.normalizeStageStatuses(job);
    stageStatuses[stage] = status;
    job.stageStatuses = stageStatuses;

    if (options.setCurrentStage !== false) {
      job.currentStage = stage;
    }

    if (options.overallStatus) {
      job.status = options.overallStatus;
    }

    if (options.error !== undefined) {
      job.error = options.error;
    } else if (options.clearError) {
      job.error = undefined;
    }

    await job.save();
    return job;
  }

  private normalizeStageStatuses(job: AudioJobDocument) {
    if (job.stageStatuses instanceof Map) {
      return Object.fromEntries(
        job.stageStatuses.entries(),
      ) as Partial<Record<StageTypes, StatusTypes>>;
    }

    return { ...(job.stageStatuses ?? {}) };
  }

  private normalizeArtifacts(job: AudioJobDocument): AudioJobArtifacts {
    return {
      transcription: job.artifacts?.transcription ?? false,
      diarisation: job.artifacts?.diarisation ?? false,
      mergedConversation: job.artifacts?.mergedConversation ?? false,
      llmOutputId: job.artifacts?.llmOutputId ?? null,
    };
  }
}
