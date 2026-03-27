import { InjectModel } from '@nestjs/mongoose';
import { LlmService } from '../llm/llm.service';
import { Document, DocumentDocument } from '../schemas/document.schema';
import { Model } from 'mongoose';
import { AuthService } from '../auth/auth.service';
import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';

interface DocumentEvent {
  title: string;
  content: string;
}
@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  constructor(
    private readonly llmService: LlmService,
    private readonly authService: AuthService,
    @InjectModel(Document.name)
    private readonly documentModel: Model<DocumentDocument>,
  ) {}
  async generateDocument(task: string, context: string) {
    const prompt = this.buildPrompt(task, context);
    const result = await this.llmService.generateContent(prompt);
    const parsed = this.llmService.tryParseJson(result);
    if (parsed && typeof parsed === 'object') {
      const candidate = parsed as Record<string, unknown>;
      const title =
        typeof candidate.title === 'string' ? candidate.title.trim() : '';
      const content =
        typeof candidate.content === 'string' ? candidate.content.trim() : '';

      return {
        title,
        content,
      };
    }
    return null;
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

  async createDocument(
    document: DocumentEvent,
    meetingId: string,
    googleId: string,
  ) {
    const oauth2Client = await this.getClient(googleId);
    if (!oauth2Client) {
      this.logger.warn('No authenticated user found - cannot create document');
      return null;
    }
    const docs = google.docs({ version: 'v1', auth: oauth2Client });
    try {
      const response = await docs.documents.create({
        requestBody: {
          title: document.title,
        },
      });
      const documentId = response.data.documentId;

      if (documentId && document.content) {
        await docs.documents.batchUpdate({
          documentId: documentId,
          requestBody: {
            requests: [
              {
                insertText: {
                  location: {
                    index: 1, // Insert at the beginning of the document
                  },
                  text: document.content,
                },
              },
            ],
          },
        });
      }
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create document', error);
      throw error;
    }
  }

  async saveDocument(
    document: DocumentEvent,
    meetingId: string,
    task: string,
    googleId?: string,
  ) {
    return this.documentModel.create({
      meetingId,
      googleId,
      title: document.title,
      content: document.content,
      task: task,
    });
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
