import { Processor, Process } from "@nestjs/bull/lib/decorators";
import { ACTION_QUEUE, PROCESS_ACTION_JOB } from "./queue-constants";
import type { MeetingSummaryOutput } from "../llm/llm.service";

@Processor(ACTION_QUEUE)
export class ActionQueue{
  @Process(PROCESS_ACTION_JOB)
  async handleActionJob(llmResponse: MeetingSummaryOutput, meetingId: string){
    for(const action of llmResponse.action_items){
      
    }
  }
}
