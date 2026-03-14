import { Injectable } from '@nestjs/common';
import { GeminiClient } from '../utilities/GeminiClient';

@Injectable()
export class LlmService {
  private readonly llmModel = process.env.LLM_MODEL || 'gemini-1.5-flash';
  constructor(private readonly geminiClient: GeminiClient) {}
  async generateAnswer(conv: string) {
    const model = this.geminiClient.getObject().getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        maxOutputTokens: 700,
      },
    });

    const prompt = this.buildPrompt(conv);
    const result = await model.generateContent(prompt);
    const answer = result.response.text()?.trim() ?? '';

    return {
      answer: answer || 'I could not generate a response for this question.',
      model: this.llmModel,
    };
  }
  private buildPrompt(conv: string) {
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

TRANSCRIPT:
${conv}
`;
  }
}
