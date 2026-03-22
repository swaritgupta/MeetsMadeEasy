import { Processor, Process, InjectQueue } from "@nestjs/bull";
import { ACTION_QUEUE, EMAIL_QUEUE, PROCESS_ACTION_JOB, PROCESS_AUDIO_JOB, PROCESS_EMAIL_JOB } from "./queue-constants";
import type { MeetingSummaryOutput } from "../llm/llm.service";
import type { Job, Queue } from "bull";

@Processor(ACTION_QUEUE)
export class ActionQueue{
  constructor(
    @InjectQueue(EMAIL_QUEUE)
    private readonly emailQueue: Queue,
  ){}
  @Process(PROCESS_ACTION_JOB)
  async handleActionJob(job: Job<MeetingSummaryOutput & { meetingId: string }>){
    const { meetingId, action_items, summary } = job.data;
    if (!Array.isArray(action_items)) {
      return;
    }

    for(const action of action_items){
      const type = this.intent(action.task);
      switch(type){
        case 'SCHEDULE':
        case 'EMAIL':
          await this.emailQueue.add(PROCESS_EMAIL_JOB, {
            task:     action.task,
            assignee: action.assigned_to,
            context:  summary,   // give the email agent context
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
