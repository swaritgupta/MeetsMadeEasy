import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpUtil } from '../utilities/HttpUtil';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

@Injectable()
export class DiarisationService {
  private readonly baseUrl = process.env.DIARISATION_MS_URL || 'http://127.0.0.1:8001';
  constructor(private readonly httpUtil: HttpUtil){}
  async diariseAudio(filePath: string){
    if (!filePath || !fs.existsSync(filePath)) {
      throw new HttpException('Audio file not found for diarisation', HttpStatus.BAD_REQUEST);
    }
    const url = `${this.baseUrl}/diarise`;
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), path.basename(filePath));
    console.log('Before diarisation')
    const timeoutMs = Number(process.env.DIARISATION_TIMEOUT_MS || 300000);
    const response = await this.httpUtil.post<any>(url, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: Number.isFinite(timeoutMs) ? timeoutMs : 300000,
    });
    console.log('After diarisation')
    return response;
  }
}
