import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type DocumentDocument = HydratedDocument<Document>;

@Schema({
  timestamps: true,
})
export class Document {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  content!: string;

  @Prop({ required: true })
  task!: string;

  @Prop({ required: true, index: true })
  meetingId!: string;

  createdAt?: Date;

  updatedAt?: Date;
}

export const DocumentSchema = SchemaFactory.createForClass(Document);