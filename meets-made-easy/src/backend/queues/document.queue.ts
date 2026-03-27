import type { Job } from 'bull';
import { DOCUMENT_QUEUE, PROCESS_DOCUMENT_JOB } from './queue-constants';
import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { DocumentService } from '../agent-services/document.service';
import { Logger } from '@nestjs/common';

interface DocumentJobData {
  task: string;
  assignee: string;
  context: string;
  meetingId: string;
  googleId?: string;
}

@Processor(DOCUMENT_QUEUE)
export class DocumentQueue {
  private readonly logger = new Logger(DocumentQueue.name);

  constructor(private readonly documentService: DocumentService) {}

  @Process(PROCESS_DOCUMENT_JOB)
  async handleDocumentJob(job: Job<DocumentJobData>) {
    this.logger.log(
      `Document job is being processed for task: "${job.data.task}"`,
    );
    const googleId = job.data.googleId?.trim();
    if (!googleId) {
      this.logger.warn(
        `Skipping document creation for task "${job.data.task}" because googleId is missing`,
      );
      return;
    }
    const { task, context, meetingId } = job.data;
    const doc = await this.documentService.generateDocument(task, context);
    if (doc) {
      this.logger.log(`Generated document content for: "${doc.title}"`);
      const createdDoc = await this.documentService.createDocument(
        doc,
        meetingId,
        googleId,
      );
      if (createdDoc?.documentId) {
        this.logger.log(
          `Google Document successfully created with ID: ${createdDoc.documentId}`,
        );
      }
      await this.documentService.saveDocument(doc, meetingId, task, googleId);
    } else {
      this.logger.warn(
        `Failed to generate document content for task: "${task}"`,
      );
    }
  }
}
