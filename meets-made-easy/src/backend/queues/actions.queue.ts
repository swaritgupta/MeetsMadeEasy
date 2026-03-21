import { Processor, Process, InjectQueue } from "@nestjs/bull/lib/decorators";
import { ACTION_QUEUE, EMAIL_QUEUE, PROCESS_ACTION_JOB, PROCESS_AUDIO_JOB } from "./queue-constants";
import type { MeetingSummaryOutput } from "../llm/llm.service";
import type { Queue } from "bull";

@Processor(ACTION_QUEUE)
export class ActionQueue{
  constructor(
    @InjectQueue(EMAIL_QUEUE)
    private readonly emailQueue: Queue,
  ){}
  @Process(PROCESS_ACTION_JOB)
  async handleActionJob(llmResponse: MeetingSummaryOutput, meetingId: string){
    for(const action of llmResponse.action_items){
      const type = this.intent(action.task);
      switch(type){
        case 'SCHEDULE':
          await this.emailQueue.add(PROCESS_AUDIO_JOB, {
            task:     action.task,
            assignee: action.assigned_to,
            context:  llmResponse.summary,   // give the email agent context
            meetingId,
          });
          break;
      }
    }
  }

  private intent(task: string){
    const t = task.toLowerCase();
    if (t.match(/schedule|call|meeting|book|set up/))  return 'SCHEDULE';
    if (t.match(/email|send|write|draft|reply/))        return 'EMAIL';
    if (t.match(/create|ticket|issue|task|build|fix/)) return 'TASK';
    if (t.match(/post|notify|share|update|announce/))  return 'SLACK';
    return 'TASK';
  }
}
