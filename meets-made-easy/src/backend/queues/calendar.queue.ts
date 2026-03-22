import { Processor, Process } from "@nestjs/bull";
import { CALENDAR_QUEUE, PROCESS_CALENDAR_JOB } from "./queue-constants";
import type { Job } from "bull";
import { LlmService } from "../llm/llm.service";
interface CalendarJobPayload{
  task: string;
  assignee: string;
  context: string;
}
@Processor(CALENDAR_QUEUE)
export class CalendarQueue{
  constructor(private readonly llmService: LlmService){

  }
  @Process(PROCESS_CALENDAR_JOB)
  async handleCalendarJob(job: Job<CalendarJobPayload>){
    //console.log(job.data);
    const { task, assignee, context } = job.data;
    
  }
}