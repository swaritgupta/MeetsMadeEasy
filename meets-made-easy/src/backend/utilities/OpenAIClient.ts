import OpenAI from "openai";

export class OpenAIClient{
  private openai!: OpenAI;

  constructor(){
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  public getObject(){
    return this.openai;
  }
}