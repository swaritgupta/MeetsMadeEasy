import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { HttpUtil } from './HttpUtil';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  providers: [HttpUtil],
  exports: [HttpUtil],
})
export class HttpUtilModule {}
