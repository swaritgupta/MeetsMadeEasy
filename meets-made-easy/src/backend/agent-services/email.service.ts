import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { AuthService } from '../auth/auth.service';
import { google } from 'googleapis';

export type EmailDraft = {
  to: string;
  subject: string;
  body: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(LlmService.name);
  constructor(
    private readonly authService: AuthService,
    private readonly llmService: LlmService,
  ) {}

  async generateEmailDraft(task: string, context: string) {
    const prompt = `
You are an assistant that drafts professional emails.

Return ONLY valid JSON matching this exact schema:
{
  "to": "string",
  "subject": "string",
  "body": "string"
}

Instructions:
- Use the task and context to draft a concise, polished email.
- If the recipient is not specified, set "to" to an empty string.
- Keep the subject clear and specific.
- Write the body as plain text with natural paragraph breaks.
- Do not wrap the JSON in markdown or code fences.

TASK:
${task}

CONTEXT:
${context}
`;

    const answer = await this.llmService.generateContent(prompt);
    const parsed = this.llmService.tryParseJson(answer);

    if (parsed && typeof parsed === 'object') {
      const candidate = parsed as Record<string, unknown>;
      const to = typeof candidate.to === 'string' ? candidate.to.trim() : '';
      const subject =
        typeof candidate.subject === 'string' ? candidate.subject.trim() : '';
      const body =
        typeof candidate.body === 'string' ? candidate.body.trim() : '';

      if (subject && body) {
        return {
          to,
          subject,
          body,
        };
      }
    }

    return {
      to: '',
      subject: task.trim() || 'Meeting Follow-up',
      body: answer || context || 'Unable to generate email draft.',
    };
  }

  async createDraft(
    email: EmailDraft,
    googleId: string,
  ): Promise<{ id: string; message: { id: string } } | null> {
    const oauth2Client = await this.getClient(googleId);
    if (!oauth2Client) {
      this.logger.warn(
        'No authenticated user found — cannot create Gmail draft.',
      );
      return null;
    }

    // Construct a raw RFC 2822 email and base64url-encode it.
    const messageParts: string[] = [];
    // Only include the To header if it looks like a real email address.
    // The LLM often returns a speaker name (e.g. "client") instead of an email.
    if (email.to && email.to.includes('@')) {
      messageParts.push(`To: ${email.to}`);
    }
    messageParts.push(
      `Subject: ${email.subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      email.body,
    );
    const rawMessage = messageParts.join('\n');
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    try {
      const response = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: { raw: encodedMessage },
        },
      });

      this.logger.log(`Gmail draft created: ${response.data.id}`);
      return response.data as { id: string; message: { id: string } };
    } catch (error) {
      this.logger.error('Failed to create Gmail draft', error);
      throw error;
    }
  }

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
}
