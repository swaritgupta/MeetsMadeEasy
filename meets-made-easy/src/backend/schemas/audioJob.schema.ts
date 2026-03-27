import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { StageTypes } from '../types/stage.enum';
import { StatusTypes } from '../types/status.enum';

export type AudioJobDocument = HydratedDocument<AudioJob>;
export type AudioJobArtifacts = {
  transcription?: boolean;
  diarisation?: boolean;
  mergedConversation?: boolean;
  llmOutputId?: string | null;
};

@Schema({
  timestamps: true,
})
export class AudioJob {
  @Prop({ required: true, unique: true, index: true })
  jobKey!: string;

  @Prop({ required: true, index: true })
  googleId!: string;

  @Prop({
    required: true,
    enum: Object.values(StatusTypes),
    default: StatusTypes.QUEUED,
  })
  status!: StatusTypes;

  @Prop({
    required: true,
    enum: Object.values(StageTypes),
    default: StageTypes.AUDIO_PROCESSING,
  })
  currentStage!: StageTypes;

  @Prop({ type: Map, of: String, default: {} })
  stageStatuses!: Partial<Record<StageTypes, StatusTypes>>;

  @Prop({
    type: {
      transcription: { type: Boolean, default: false },
      diarisation: { type: Boolean, default: false },
      mergedConversation: { type: Boolean, default: false },
      llmOutputId: { type: String, default: null },
    },
    default: {},
  })
  artifacts!: AudioJobArtifacts;

  @Prop()
  error?: string;

  createdAt?: Date;

  updatedAt?: Date;
}

export const AudioJobSchema = SchemaFactory.createForClass(AudioJob);
