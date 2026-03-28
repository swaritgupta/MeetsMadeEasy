import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AudioJobArtifact,
  AudioJobArtifactDocument,
} from '../schemas/audio-job-artifact.schema';

@Injectable()
export class AudioJobStateService {
  constructor(
    @InjectModel(AudioJobArtifact.name)
    private readonly audioJobArtifactModel: Model<AudioJobArtifactDocument>,
  ) {}

  async storeTranscription(
    jobKey: string,
    transcription: unknown,
  ): Promise<void> {
    await this.audioJobArtifactModel
      .findOneAndUpdate(
        { jobKey },
        { $set: { transcription } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      .exec();
  }

  async storeDiarisation(jobKey: string, diarisation: unknown): Promise<void> {
    await this.audioJobArtifactModel
      .findOneAndUpdate(
        { jobKey },
        { $set: { diarisation } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      .exec();
  }

  async storeMergedConversation(
    jobKey: string,
    mergedConversation: unknown,
  ): Promise<void> {
    await this.audioJobArtifactModel
      .findOneAndUpdate(
        { jobKey },
        { $set: { mergedConversation } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      .exec();
  }

  async getTranscription<T>(jobKey: string): Promise<T | null> {
    const artifact = await this.audioJobArtifactModel.findOne({ jobKey }).exec();
    return (artifact?.transcription as T | undefined) ?? null;
  }

  async getDiarisation<T>(jobKey: string): Promise<T | null> {
    const artifact = await this.audioJobArtifactModel.findOne({ jobKey }).exec();
    return (artifact?.diarisation as T | undefined) ?? null;
  }

  async getMergedConversation<T>(jobKey: string): Promise<T | null> {
    const artifact = await this.audioJobArtifactModel.findOne({ jobKey }).exec();
    return (artifact?.mergedConversation as T | undefined) ?? null;
  }

  async getArtifacts(jobKey: string): Promise<AudioJobArtifactDocument | null> {
    return this.audioJobArtifactModel.findOne({ jobKey }).exec();
  }

  async cleanup(jobKey: string): Promise<void> {
    await this.audioJobArtifactModel.deleteOne({ jobKey }).exec();
  }
}
