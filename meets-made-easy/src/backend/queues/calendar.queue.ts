import { Processor, Process } from "@nestjs/bull";
import { CALENDAR_QUEUE, PROCESS_CALENDAR_JOB } from "./queue-constants";
import type { Job } from "bull";
import { CalendarService } from "../agent-services/calendar.service";
import { DateTimeParser } from "../utilities/DateTimeParser";
import { Logger } from "@nestjs/common";

interface CalendarJobPayload {
  task: string;
  assignee: string;
  context: string;
  deadline?: string;
}

@Processor(CALENDAR_QUEUE)
export class CalendarQueue {
  private readonly logger = new Logger(CalendarQueue.name);

  constructor(
    private readonly calendarService: CalendarService,
    private readonly dateTimeParser: DateTimeParser,
  ) { }

  @Process(PROCESS_CALENDAR_JOB)
  async handleCalendarJob(job: Job<CalendarJobPayload>) {
    console.log("Calendar job is being processed");
    const { task, assignee, context, deadline } = job.data;

    // 1. Ask Gemini to generate event metadata (title, description, duration)
    const eventMeta = await this.calendarService.generateCalendarEvent(task, context, deadline);
    if (!eventMeta) {
      this.logger.warn(`Could not generate calendar event metadata for task: "${task}"`);
      return;
    }

    // 2. Resolve the meeting time from the task text. 
    //    We should NOT use the 'deadline', because that's when the action item is due, not the meeting!
    const parsed = await this.dateTimeParser.parse(task, context);

    let from: Date;
    let to: Date;

    if (parsed) {
      const range = this.dateTimeParser.computeRange(parsed.startISO, eventMeta.suggestedDuration);
      from = range.from;
      to = range.to;
      this.logger.log(
        `Resolved date from task "${task}" → ${from.toISOString()} (confidence: ${parsed.confidence})`,
      );
    } else {
      // Fallback: schedule for tomorrow at 10 AM if we can't parse any date
      this.logger.warn(`Could not parse date from task — defaulting to tomorrow 10 AM`);
      from = new Date();
      from.setDate(from.getDate() + 1);
      from.setHours(10, 0, 0, 0);
      to = new Date(from.getTime() + eventMeta.suggestedDuration * 60 * 1000);
    }

    // 3. Create the event on Google Calendar
    const result = await this.calendarService.createCalendarEvent({
      from,
      to,
      title: eventMeta.title,
      // Note: assignee is the person doing the task (e.g. SPEAKER_01), not an attendee email.
      attendees: [],
      description: eventMeta.description,
    });

    if (result) {
      this.logger.log(`Calendar event "${eventMeta.title}" created: ${result.id}`);
      await this.calendarService.saveCalendarEvent({
        from,
        to,
        title: eventMeta.title,
        attendees: [],
        description: eventMeta.description,
        meetingId: result.id ?? undefined,
      });
    }
  }
}