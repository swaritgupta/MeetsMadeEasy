import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
const figlet = require('figlet');
import * as dotenv from 'dotenv';
import { connectRedis } from './utilities/RedisClient';

const banner = async (name: string) => {
  return new Promise((resolve, reject) => {
    figlet.text(name, (err: any, data: any) => {
      if(err){
        console.error("Something went wrong", err);
        reject(err);
        return;
      }
      console.log(""+data);
      resolve(data);
    });
  });
};

async function bootstrap() {
  dotenv.config({ path: '.env' });
  const bannerVal = process.env.BANNER;
  if(!bannerVal){
    console.error("Banner went missing");
    return;
  }
  await banner(bannerVal)
  await connectRedis()
  const app = await NestFactory.create(AppModule);
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || '127.0.0.1';
  await app.listen(Number(PORT), HOST);
  console.log(`🚀 Server is running on http://${HOST}:${PORT}`);
  console.log(`MeetsMadeEasy is initialized`);
}
bootstrap();
