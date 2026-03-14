import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiClient{
  private geminiClient;
  constructor(){
    const apiKey = process.env.GEMINI_API_KEY
    if(!apiKey){
      throw new Error('Api key is required for llm')
    }
    this.geminiClient = new GoogleGenerativeAI(apiKey)
  }

  public getObject(){
    return this.geminiClient;
  }
}