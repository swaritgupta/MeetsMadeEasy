import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';
import { LlmOutputService } from './llm-output.service';
import { LlmOutput, LlmOutputSchema } from './schemas/llm-output.schema';
import { GeminiClient } from '../utilities/GeminiClient';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: LlmOutput.name, schema: LlmOutputSchema }]),
    AuthModule,
  ],
  controllers: [LlmController],
  providers: [LlmService, LlmOutputService, GeminiClient],
  exports: [LlmService, LlmOutputService],
})
export class LlmModule {}

