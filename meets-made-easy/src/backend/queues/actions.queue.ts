import { Logger } from '@nestjs/common';
import { Processor, Process, InjectQueue } from '@nestjs/bull';
import {
  ACTION_QUEUE,
  CALENDAR_QUEUE,
  DOCUMENT_QUEUE,
  EMAIL_QUEUE,
  PROCESS_ACTION_JOB,
  PROCESS_CALENDAR_JOB,
  PROCESS_DOCUMENT_JOB,
  PROCESS_EMAIL_JOB,
} from './queue-constants';
import type { MeetingSummaryOutput } from '../llm/llm.service';
import type { Job, Queue } from 'bull';
import { AudioJobService } from '../utilities/AudioJobService';
import { StageTypes } from '../types/stage.enum';

@Processor(ACTION_QUEUE)
export class ActionQueue {
  private readonly logger = new Logger(ActionQueue.name);

  constructor(
    @InjectQueue(EMAIL_QUEUE)
    private readonly emailQueue: Queue,
    @InjectQueue(CALENDAR_QUEUE)
    private readonly calendarQueue: Queue,
    @InjectQueue(DOCUMENT_QUEUE)
    private readonly documentQueue: Queue,
    private readonly audioJobService: AudioJobService,
  ) {}

  @Process(PROCESS_ACTION_JOB)
  async handleActionJob(
    job: Job<MeetingSummaryOutput & { meetingId: string; googleId?: string }>,
  ) {
    const { meetingId, action_items, summary, googleId } = job.data;
    await this.audioJobService.markStageProcessing(meetingId, StageTypes.ACTIONS);

    try {
      const normalizedGoogleId = googleId?.trim();
      if (!normalizedGoogleId) {
        this.logger.warn(
          `Skipping action dispatch for meeting "${meetingId}" because googleId is missing`,
        );
        await this.audioJobService.markCompleted(meetingId, StageTypes.ACTIONS);
        return;
      }
      if (!Array.isArray(action_items)) {
        await this.audioJobService.markCompleted(meetingId, StageTypes.ACTIONS);
        return;
      }

      for (const action of action_items) {
        const type = this.intent(action.task);
        switch (type) {
          case 'SCHEDULE':
            await this.calendarQueue.add(PROCESS_CALENDAR_JOB, {
              task: action.task,
              assignee: action.assigned_to,
              context: summary,
              deadline: action.deadline ?? undefined,
              meetingId,
              googleId: normalizedGoogleId,
            });
            break;
          case 'EMAIL':
            await this.emailQueue.add(PROCESS_EMAIL_JOB, {
              task: action.task,
              assignee: action.assigned_to,
              context: summary, // give the email agent context
              meetingId,
              googleId: normalizedGoogleId,
            });
            break;
          case 'DOCUMENT':
            await this.documentQueue.add(PROCESS_DOCUMENT_JOB, {
              task: action.task,
              assignee: action.assigned_to,
              context: summary,
              meetingId,
              googleId: normalizedGoogleId,
            });
            break;
        }
      }

      await this.audioJobService.markCompleted(meetingId, StageTypes.ACTIONS);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Action dispatch failed';
      await this.audioJobService.markFailed(
        meetingId,
        StageTypes.ACTIONS,
        message,
      );
      throw error;
    }
  }

  private intent(task: string) {
    const t = task.toLowerCase();

    // Strongest signals first
    if (t.match(/calendar|event|schedule|invite|book a meeting/))
      return 'SCHEDULE';
    if (t.match(/doc|document/)) return 'DOCUMENT';
    if (t.match(/email/)) return 'EMAIL';

    // Fallbacks for vague verbs
    if (t.match(/write|draft|send|reply/)) return 'EMAIL';
    if (t.match(/report|summary|notes/)) return 'DOCUMENT';

    if (t.match(/create|ticket|issue|task|build|fix/)) return 'TASK';
    if (t.match(/post|notify|share|update|announce/)) return 'SLACK';

    return 'TASK';
  }
}
