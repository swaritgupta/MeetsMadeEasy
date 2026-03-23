import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CalendarDocument = HydratedDocument<Calendar>;

@Schema({
  timestamps: true,
})
export class Calendar{
  @Prop({unique: true, index: true})
  meetingId: string;

  @Prop()
  summary: string;

  @Prop()
  description: string;

  @Prop()
  startTime: Date;

  @Prop()
  endTime: Date;

  @Prop()
  attendees?: string[]; 

  createdAt?: Date;
}

export const CalendarSchema = SchemaFactory.createForClass(Calendar);