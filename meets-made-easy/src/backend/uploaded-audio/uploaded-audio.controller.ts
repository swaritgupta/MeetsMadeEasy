import { UploadedAudioService } from './uploaded-audio.service';
import { BadRequestException, Controller, Get, Param, Post, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'node:path';
@Controller('/api/v1.0/uploaded-audio')
export class UploadedAudioController {
  constructor(private readonly uploadedAudioService: UploadedAudioService) {}

  @Post('/upload')
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: diskStorage({
        destination: join(process.cwd(), 'data'),
        filename: (req, file, callback) => {
          const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, uniqueName + extname(file.originalname));
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4, audio/mp3'];
        if (!allowedTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException('Unsupported file type'),
            false,
          );
        }
        callback(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadAudio(@UploadedFile() file: Express.Multer.File, @Req() req: Request, @Res() res: Response){
    
    if(!file){
      throw new BadRequestException('File is required');
    }
    const result = await this.uploadedAudioService.enqueueAudioFile(file);
    return res.status(200).json({message: 'Audio file uploaded'})
  }
}
