import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type LlmOutputDocument = HydratedDocument<LlmOutput>;

type ActionItem = {
  task: string;
  assigned_to?: string;
  deadline?: string | null;
};

@Schema({ timestamps: true })
export class LlmOutput {
  @Prop({ required: true, index: true })
  jobKey!: string;

  @Prop()
  model?: string;

  @Prop()
  answer?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  parsed?: unknown;

  @Prop()
  summary?: string;

  @Prop({
    type: [{ task: String, assigned_to: String, deadline: String }],
    default: [],
  })
  actionItems!: ActionItem[];

  @Prop({ type: String })
  parseError?: string | null;

  @Prop({ default: false })
  usedRetry!: boolean;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  payload!: unknown;

  createdAt?: Date;

  updatedAt?: Date;
}

export const LlmOutputSchema = SchemaFactory.createForClass(LlmOutput);
