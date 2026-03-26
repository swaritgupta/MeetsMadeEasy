import { DOCUMENT_QUEUE, PROCESS_DOCUMENT_JOB } from "./queue-constants";
import { Processor, Process, InjectQueue } from "@nestjs/bull";

@Processor(DOCUMENT_QUEUE)
export class DocumentQueue{
  @Process(PROCESS_DOCUMENT_JOB)
  async handleDocumentJob(){
    
  }
}