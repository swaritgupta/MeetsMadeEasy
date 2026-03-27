import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { google } from 'googleapis';
import { LlmService } from '../llm/llm.service';
import { InjectModel } from '@nestjs/mongoose';
import { Calendar, CalendarDocument } from '../schemas/calendar.schema';
import { Model } from 'mongoose';

type CalendarEvent = {
  from: Date;
  to: Date;
  title: string;
  attendees?: string[];
  description?: string;
  meetingId?: string;
  googleId?: string;
};

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  constructor(
    private readonly authService: AuthService,
    private readonly llmService: LlmService,
    @InjectModel(Calendar.name)
    private readonly calendarModel: Model<CalendarDocument>,
  ) {}

  private async getClient(googleId: string) {
    // const user = googleId
    //   ? await this.authService.getUserByGoogleId(googleId)
    //   : await this.authService.getLatestUser();
    const user = await this.authService.getUserByGoogleId(googleId);

    if (!user) {
      this.logger.warn(
        'No authenticated user found — cannot create Gmail draft.',
      );
      return null;
    }

    // Build an OAuth2 client with the user's stored tokens.
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL,
    );
    oauth2Client.setCredentials({
      access_token: user.accessToken,
      refresh_token: user.refreshToken,
    });

    return oauth2Client;
  }

  async generateCalendarEvent(
    task: string,
    context: string,
    deadline?: string,
  ) {
    const prompt = `
    You are an assistant that creates calendar events.
    Based on this meeting action item, generate a calendar event.

      Action item: ${task}
      Meeting context: ${context}
      Mentioned deadline: ${deadline ?? 'not specified'}

      Respond ONLY with valid JSON:
      {
        "title": "short calendar event title (max 8 words)",
        "description": "1-2 sentence event description with context from the meeting",
        "suggestedDuration": 30
      }

      suggestedDuration is in minutes. Use 30 for quick syncs, 
      60 for regular meetings, 90 for workshops.
    `;
    const result = await this.llmService.generateContent(prompt);
    const parsed = this.llmService.tryParseJson(result);
    if (parsed && typeof parsed === 'object') {
      const candidate = parsed as Record<string, unknown>;
      const title =
        typeof candidate.title === 'string' ? candidate.title.trim() : '';
      const description =
        typeof candidate.description === 'string'
          ? candidate.description.trim()
          : '';
      const suggestedDuration =
        typeof candidate.suggestedDuration === 'number'
          ? candidate.suggestedDuration
          : 30;

      return {
        title,
        description,
        suggestedDuration,
      };
    }
    return null;
  }

  private normalizeAttendees(attendees?: string[]): string[] {
    if (!Array.isArray(attendees) || attendees.length === 0) {
      return [];
    }

    return attendees
      .map((email) => email.trim())
      .filter((email) => this.isValidEmail(email));
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async createCalendarEvent(event: CalendarEvent, googleId: string) {
    const oauth2Client = await this.getClient(googleId);
    if (!oauth2Client) {
      this.logger.warn(
        'No authenticated user found - cannot create calendar event',
      );
      return null;
    }
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const attendees = this.normalizeAttendees(event.attendees);
    const hasAttendees = attendees.length > 0;

    if ((event.attendees?.length ?? 0) > 0 && !hasAttendees) {
      this.logger.warn(
        'Dropping invalid attendee values before creating calendar event',
      );
    }

    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: event.title,
          description: event.description,
          start: { dateTime: event.from.toISOString() },
          end: { dateTime: event.to.toISOString() },
          ...(hasAttendees
            ? { attendees: attendees.map((email) => ({ email })) }
            : {}),
        },
      });

      this.logger.log(`Calendar event created: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create calendar event', error);
      throw error;
    }
  }

  async saveCalendarEvent(event: CalendarEvent) {
    const attendees = this.normalizeAttendees(event.attendees);

    return this.calendarModel.create({
      meetingId: event.meetingId,
      googleId: event.googleId,
      summary: event.title,
      description: event.description,
      startTime: event.from,
      endTime: event.to,
      attendees,
    });
  }
}
