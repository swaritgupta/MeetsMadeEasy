import { LlmService } from "../llm/llm.service";
export class DocumentService {
  constructor(private readonly llmService: LlmService){}
  async createDocument(task: string, context: string) {
    const prompt = this.buildPrompt(task, context);
    const result = await this.llmService.generateContent(prompt);
    
  }

  private buildPrompt(task: string, context: string) {
    return `
You are an expert technical writer and document creator.
Your task is to generate the content for a new document based on an action item from a meeting.

Return ONLY valid JSON matching this exact schema:
{
  "title": "short document title (max 8 words)",
  "content": "The full document content formatted in Markdown, including headings, lists, and paragraphs based on the context."
}

Instructions:
- Use the meeting context to inform the document's content, tone, and scope.
- Ensure the document fulfills the specific action item/task requested.
- Make the document comprehensive and ready to be shared with the team.
- Do not wrap the JSON in markdown or code fences.

TASK:
${task}

MEETING CONTEXT/SUMMARY:
${context}
`;
  }
}