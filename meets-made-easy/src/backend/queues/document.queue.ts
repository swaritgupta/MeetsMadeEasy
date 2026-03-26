import type { Job } from "bull";
import { DOCUMENT_QUEUE, PROCESS_DOCUMENT_JOB } from "./queue-constants";
import { Processor, Process, InjectQueue } from "@nestjs/bull";
import { DocumentService } from "../agent-services/document.service";

interface DocumentJobData {
  task: string;
  assignee: string;
  context: string;
  meetingId: string;
}

@Processor(DOCUMENT_QUEUE)
export class DocumentQueue{
  constructor(private readonly documentService: DocumentService){}
  
  @Process(PROCESS_DOCUMENT_JOB)
  async handleDocumentJob(job: Job<DocumentJobData>){
    const result = await this.documentService.createDocument(job.data);
    
  }
}