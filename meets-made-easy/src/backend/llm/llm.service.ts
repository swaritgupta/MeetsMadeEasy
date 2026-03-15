import { Injectable } from '@nestjs/common';
import { GeminiClient } from '../utilities/GeminiClient';
type Merged = {speaker: string, word: string, start: number, end: number};
@Injectable()
export class LlmService {
  private readonly llmModel = process.env.LLM_MODEL || 'gemini-2.5-flash';
  constructor(private readonly geminiClient: GeminiClient) {}
  async generateAnswer(conv: Merged[]) {
    const model = this.geminiClient.getObject().getGenerativeModel({
      model: this.llmModel,
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        maxOutputTokens: 1200,
        responseMimeType: 'application/json',
      },
    });

    const prompt = this.buildPrompt(conv);
    const result = await model.generateContent(prompt);
    const answer = result.response.text()?.trim() ?? '';
    const parsed = this.tryParseJson(answer);

    return {
      answer: answer || 'I could not generate a response for this question.',
      model: this.llmModel,
      parsed,
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
}
