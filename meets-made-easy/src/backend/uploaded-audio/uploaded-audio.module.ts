import { Module } from '@nestjs/common';
import { UploadedAudioService } from './uploaded-audio.service';
import { UploadedAudioController } from './uploaded-audio.controller';
import { BullModule } from '@nestjs/bull';
import {
  AUDIO_PROCESSING_QUEUE,
  TRANSCRIPTION_QUEUE,
  DIARISATION_QUEUE,
  MERGE_QUEUE,
  LLM_QUEUE,
  EMAIL_QUEUE,
  ACTION_QUEUE,
  CALENDAR_QUEUE,
  DOCUMENT_QUEUE,
} from '../queues/queue-constants';
import { AudioProcessor } from '../queues/audio.queue';
import { TranscriptionProcessor } from '../queues/transcription.queue';
import { DiarisationProcessor } from '../queues/diarisation.queue';
import { MergeProcessor } from '../queues/merge.queue';
import { LlmQueue } from '../queues/llm.queue';
import { DiarisationService } from '../diarisation/diarisation.service';
import { HttpUtilModule } from '../utilities/http-util.module';
import { AudioJobStateService } from '../queues/audio-job-state.service';
import { LlmModule } from '../llm/llm.module';
import { ActionQueue } from '../queues/actions.queue';
import { EmailProcessor } from '../queues/email.queue';
import { CalendarQueue } from '../queues/calendar.queue';
import { CalendarService } from '../agent-services/calendar.service';
import { DateTimeParser } from '../utilities/DateTimeParser';
import { AuthModule } from '../auth/auth.module';
import { EmailService } from '../agent-services/email.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Calendar, CalendarSchema } from '../schemas/calendar.schema';
import { DocumentQueue } from '../queues/document.queue';
import { DocumentService } from '../agent-services/document.service';
import { Document, DocumentSchema } from '../schemas/document.schema';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: AUDIO_PROCESSING_QUEUE },
      { name: TRANSCRIPTION_QUEUE },
      { name: DIARISATION_QUEUE },
      { name: MERGE_QUEUE },
      { name: LLM_QUEUE },
      { name: ACTION_QUEUE },
      { name: EMAIL_QUEUE },
      { name: CALENDAR_QUEUE },
      { name: DOCUMENT_QUEUE },
    ),
    MongooseModule.forFeature([
      { name: Calendar.name, schema: CalendarSchema },
    ]),
    MongooseModule.forFeature([
      { name: Document.name, schema: DocumentSchema },
    ]),
    HttpUtilModule,
    LlmModule,
    AuthModule,
  ],
  controllers: [UploadedAudioController],
  providers: [
    UploadedAudioService,
    AudioProcessor,
    TranscriptionProcessor,
    DiarisationProcessor,
    MergeProcessor,
    LlmQueue,
    AudioJobStateService,
    DiarisationService,
    EmailProcessor,
    EmailService,
    ActionQueue,
    CalendarQueue,
    CalendarService,
    DateTimeParser,
    DocumentQueue,
    DocumentService,
  ],
})
export class UploadedAudioModule {}
