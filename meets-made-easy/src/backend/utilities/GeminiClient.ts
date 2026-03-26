import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiClient {
  private geminiClient;
  constructor() {
    const apiKey =
      process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        'A Gemini API key is required. Set GOOGLE_API_KEY or GEMINI_API_KEY to a valid Gemini API key from Google AI Studio.',
      );
    }
    this.geminiClient = new GoogleGenerativeAI(apiKey);
  }

  public getObject() {
    return this.geminiClient;
  }
}
