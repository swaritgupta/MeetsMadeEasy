import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type AudioJobArtifactDocument = HydratedDocument<AudioJobArtifact>;

@Schema({ timestamps: true })
export class AudioJobArtifact {
  @Prop({ required: true, unique: true, index: true })
  jobKey!: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  transcription?: unknown;

  @Prop({ type: MongooseSchema.Types.Mixed })
  diarisation?: unknown;

  @Prop({ type: MongooseSchema.Types.Mixed })
  mergedConversation?: unknown;

  createdAt?: Date;

  updatedAt?: Date;
}

export const AudioJobArtifactSchema =
  SchemaFactory.createForClass(AudioJobArtifact);
