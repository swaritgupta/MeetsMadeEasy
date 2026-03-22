import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';

export interface ParsedDateTime {
  /** ISO 8601 start time, e.g. "2026-03-25T10:00:00+05:30" */
  startISO: string;
  /** Confidence: 'exact' if a concrete date was mentioned, 'inferred' if the LLM guessed */
  confidence: 'exact' | 'inferred';
}

/**
 * Uses Gemini to resolve natural-language date/time references
 * (e.g. "next Tuesday", "end of week", "March 25th at 3pm")
 * into concrete ISO 8601 timestamps.
 */
@Injectable()
export class DateTimeParser {
  private readonly logger = new Logger(DateTimeParser.name);

  constructor(private readonly llmService: LlmService) {}

  /**
   * Parse a fuzzy date/time string (from an action item's deadline or task text)
   * into a concrete ISO 8601 start time.
   *
   * @param text           The natural-language date expression (e.g. "next Monday", "by Friday 3pm")
   * @param contextHint    Optional meeting context to help resolve ambiguity
   * @param referenceDate  The "now" anchor (defaults to current time)
   */
  async parse(
    text: string,
    contextHint?: string,
    referenceDate: Date = new Date(),
  ): Promise<ParsedDateTime | null> {
    if (!text || !text.trim()) {
      return null;
    }

    const refISO = referenceDate.toISOString();
    const refLocale = referenceDate.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const prompt = `
You are a date/time parser. Given a natural-language date/time expression,
resolve it to a concrete ISO 8601 datetime string.

Current reference time: ${refISO} (${refLocale})
Timezone: Asia/Kolkata (UTC+05:30)

Expression to parse: "${text}"
${contextHint ? `Meeting context: ${contextHint}` : ''}

Rules:
- If a specific date is mentioned (e.g. "March 25th", "next Tuesday"), resolve it relative to the reference time.
- If only a day-of-week is mentioned, pick the NEXT occurrence of that day.
- If no time-of-day is mentioned, default to 10:00 AM.
- If the expression is vague (e.g. "soon", "later", "end of week"), make your best guess.
- "End of week" = Friday 5:00 PM of the current or next week.
- "Tomorrow" = the next calendar day.

Respond ONLY with valid JSON:
{
  "startISO": "ISO 8601 datetime string with timezone offset, e.g. 2026-03-25T10:00:00+05:30",
  "confidence": "exact" or "inferred"
}

Do not wrap in markdown or code fences.
`;

    try {
      const answer = await this.llmService.generateContent(prompt);
      const parsed = this.llmService.tryParseJson(answer);

      if (parsed && typeof parsed === 'object') {
        const candidate = parsed as Record<string, unknown>;
        const startISO = typeof candidate.startISO === 'string' ? candidate.startISO.trim() : '';
        const confidence = candidate.confidence === 'exact' ? 'exact' : 'inferred';

        // Validate that the ISO string is actually parseable
        if (startISO && !isNaN(new Date(startISO).getTime())) {
          return { startISO, confidence };
        }

        this.logger.warn(`LLM returned unparseable date: "${startISO}"`);
      }
    } catch (error) {
      this.logger.error(`Failed to parse datetime from "${text}"`, error);
    }

    return null;
  }

  /**
   * Convenience: compute a start and end Date from a parsed datetime + duration.
   */
  computeRange(
    startISO: string,
    durationMinutes: number,
  ): { from: Date; to: Date } {
    const from = new Date(startISO);
    const to = new Date(from.getTime() + durationMinutes * 60 * 1000);
    return { from, to };
  }
}
