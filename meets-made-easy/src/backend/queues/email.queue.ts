import { Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { EMAIL_QUEUE, PROCESS_EMAIL_JOB } from './queue-constants';
import { EmailService } from '../agent-services/email.service';

interface EmailJobPayload {
  task: string;
  assignee: string;
  context: string;
  googleId?: string;
}
@Processor(EMAIL_QUEUE)
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {}

  @Process(PROCESS_EMAIL_JOB)
  async process(job: Job<EmailJobPayload>) {
    const { task, assignee, context } = job.data;
    const googleId = job.data.googleId?.trim();
    if (!googleId) {
      this.logger.warn(
        `Skipping email draft creation for task "${task}" because googleId is missing`,
      );
      return;
    }

    // Use Gemini again to DRAFT the email body
    const draft = await this.emailService.generateEmailDraft(task, context);

    // Don't send automatically — save as draft for human review
    await this.emailService.createDraft(
      {
        //to:      this.resolveEmail(assignee),  // map speaker → real email
        to: draft.to,
        subject: draft.subject,
        body: draft.body,
      },
      googleId,
    );

    // Notify user that a draft is ready
    // await this.notificationService.notify(
    //   `Email draft ready for your review: "${draft.subject}"`
    // );
  }
}
