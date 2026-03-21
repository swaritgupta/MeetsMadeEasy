import { Injectable, Logger } from '@nestjs/common';
import { GeminiClient } from '../utilities/GeminiClient';
import { AuthService } from '../auth/auth.service';
import { google } from 'googleapis';

type Merged = { speaker: string; word: string; start: number; end: number };
type MeetingSentiment = 'positive' | 'neutral' | 'tense';

export type MeetingDecision = {
  decision: string;
  made_by?: string;
};

export type MeetingActionItem = {
  task: string;
  assigned_to?: string;
  deadline?: string | null;
};

export type MeetingSummaryOutput = {
  summary: string;
  key_decisions: MeetingDecision[];
  action_items: MeetingActionItem[];
  open_questions: string[];
  topics_discussed: string[];
  meeting_sentiment: MeetingSentiment;
};

export type LlmAnswerResult = {
  answer: string;
  model: string;
  parsed: MeetingSummaryOutput | null;
  parseError: string | null;
  usedRetry: boolean;
};

export type EmailDraft = {
  to: string;
  subject: string;
  body: string;
}

type ParseResult = {
  parsed: MeetingSummaryOutput | null;
  parseError: string | null;
};

@Injectable()
export class LlmService {
  private readonly llmModel = process.env.LLM_MODEL || 'gemini-2.5-flash';

  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly geminiClient: GeminiClient,
    private readonly authService: AuthService,
  ) {}

  async generateAnswer(conv: Merged[]): Promise<LlmAnswerResult> {
    const prompt = this.buildPrompt(conv);
    const firstAnswer = await this.generateContent(prompt);
    let finalAnswer = firstAnswer;
    let parseResult = this.parseAndValidate(firstAnswer);
    let usedRetry = false;

    // Retry once with a stricter repair prompt when the first response is malformed.
    if (!parseResult.parsed) {
      usedRetry = true;
      const retryPrompt = this.buildRetryPrompt(conv, firstAnswer, parseResult.parseError);
      const retryAnswer = await this.generateContent(retryPrompt);
      const retryResult = this.parseAndValidate(retryAnswer);

      if (retryAnswer) {
        finalAnswer = retryAnswer;
      }
      parseResult = retryResult;
    }

    return {
      answer: finalAnswer || 'I could not generate a response for this question.',
      model: this.llmModel,
      parsed: parseResult.parsed,
      parseError: parseResult.parseError,
      usedRetry,
    };
  }

  private buildPrompt(conv: Merged[]) {
    const transcript = conv
      .map((seg) => `[${seg.start}-${seg.end}] ${seg.speaker}: ${seg.word}`)
      .join('\n');

    const prompt = `
You are a meeting analyst. Given the following meeting transcript 
with speaker labels, extract structured information.

Respond ONLY with valid JSON matching this exact schema:
{
  "summary": "3-5 sentence overview of the meeting",
  "key_decisions": [
    { "decision": "string", "made_by": "speaker label" }
  ],
  "action_items": [
    { "task": "string", "assigned_to": "speaker label", "deadline": "string or null" }
  ],
  "open_questions": ["string"],
  "topics_discussed": ["string"],
  "meeting_sentiment": "positive | neutral | tense"
}
Do not wrap the JSON in markdown or code fences.

TRANSCRIPT:
${transcript}
`;
    return prompt;
  }

  private buildRetryPrompt(conv: Merged[], invalidAnswer: string, parseError: string | null): string {
    const transcript = conv
      .map((seg) => `[${seg.start}-${seg.end}] ${seg.speaker}: ${seg.word}`)
      .join('\n');

    return `
Your previous response did not pass JSON validation.
Reason: ${parseError ?? 'The response was incomplete or malformed.'}

Return ONLY valid JSON matching this exact schema:
{
  "summary": "3-5 sentence overview of the meeting",
  "key_decisions": [
    { "decision": "string", "made_by": "speaker label" }
  ],
  "action_items": [
    { "task": "string", "assigned_to": "speaker label", "deadline": "string or null" }
  ],
  "open_questions": ["string"],
  "topics_discussed": ["string"],
  "meeting_sentiment": "positive | neutral | tense"
}
Do not wrap the JSON in markdown or code fences.
Do not truncate the response.

PREVIOUS INVALID RESPONSE:
${invalidAnswer || 'No content returned.'}

TRANSCRIPT:
${transcript}
`;
  }

  private async generateContent(prompt: string): Promise<string> {
    const model = this.geminiClient.getObject().getGenerativeModel({
      model: this.llmModel,
      generationConfig: {
        temperature: 0.1,
        topP: 0.9,
        maxOutputTokens: 2500,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(prompt);
    return result.response.text()?.trim() ?? '';
  }

  async generateEmailDraft(task: string, context: string){
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

    const answer = await this.generateContent(prompt);
    const parsed = this.tryParseJson(answer);

    if (parsed && typeof parsed === 'object') {
      const candidate = parsed as Record<string, unknown>;
      const to = typeof candidate.to === 'string' ? candidate.to.trim() : '';
      const subject = typeof candidate.subject === 'string' ? candidate.subject.trim() : '';
      const body = typeof candidate.body === 'string' ? candidate.body.trim() : '';

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

  async createDraft(email: EmailDraft, googleId?: string): Promise<{ id: string; message: { id: string } } | null> {
    // Retrieve the user's OAuth tokens.
    // If a googleId is provided, use it; otherwise fall back to the most recent user.
    const user = googleId
      ? await this.authService.getUserByGoogleId(googleId)
      : await this.authService.getLatestUser();

    if (!user) {
      this.logger.warn('No authenticated user found — cannot create Gmail draft.');
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

    // Construct a raw RFC 2822 email and base64url-encode it.
    const messageParts = [
      `To: ${email.to}`,
      `Subject: ${email.subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      email.body,
    ];
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

  private parseAndValidate(raw: string): ParseResult {
    const parsedJson = this.tryParseJson(raw);
    if (!parsedJson) {
      return {
        parsed: null,
        parseError: 'Response was not valid JSON.',
      };
    }

    const normalized = this.normalizeMeetingOutput(parsedJson);
    if (!normalized) {
      return {
        parsed: null,
        parseError: 'Response JSON did not match the expected meeting summary shape.',
      };
    }

    return {
      parsed: normalized,
      parseError: null,
    };
  }

  private tryParseJson(raw: string): unknown | null {
    if (!raw) {
      return null;
    }

    let text = raw.trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
    }

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      text = text.slice(firstBrace, lastBrace + 1);
    }

    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  private normalizeMeetingOutput(value: unknown): MeetingSummaryOutput | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Record<string, unknown>;
    const summary = typeof candidate.summary === 'string' ? candidate.summary.trim() : '';
    const meetingSentiment = this.normalizeSentiment(candidate.meeting_sentiment);

    if (!summary || !meetingSentiment) {
      return null;
    }

    return {
      summary,
      key_decisions: this.normalizeDecisions(candidate.key_decisions),
      action_items: this.normalizeActionItems(candidate.action_items),
      open_questions: this.normalizeStringArray(candidate.open_questions),
      topics_discussed: this.normalizeStringArray(candidate.topics_discussed),
      meeting_sentiment: meetingSentiment,
    };
  }

  private normalizeDecisions(value: unknown): MeetingDecision[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const decisions: MeetingDecision[] = [];

    for (const item of value) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const record = item as Record<string, unknown>;
      const decisionValue = record.decision;
      const madeByValue = record.made_by;
      const decision = typeof decisionValue === 'string' ? decisionValue.trim() : '';
      const madeBy = typeof madeByValue === 'string' ? madeByValue.trim() : undefined;

      if (!decision) {
        continue;
      }

      decisions.push({
        decision,
        made_by: madeBy,
      });
    }

    return decisions;
  }

  private normalizeActionItems(value: unknown): MeetingActionItem[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const actionItems: MeetingActionItem[] = [];

    for (const item of value) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const record = item as Record<string, unknown>;
      const taskValue = record.task;
      const assignedToValue = record.assigned_to;
      const deadlineValue = record.deadline;
      const task = typeof taskValue === 'string' ? taskValue.trim() : '';
      const assignedTo =
        typeof assignedToValue === 'string' ? assignedToValue.trim() : undefined;

      if (!task) {
        continue;
      }

      actionItems.push({
        task,
        assigned_to: assignedTo,
        deadline:
          typeof deadlineValue === 'string' || deadlineValue === null
            ? deadlineValue
            : undefined,
      });
    }

    return actionItems;
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private normalizeSentiment(value: unknown): MeetingSentiment | null {
    if (value === 'positive' || value === 'neutral' || value === 'tense') {
      return value;
    }

    return null;
  }
}
