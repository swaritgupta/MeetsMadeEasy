import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
const figlet = require('figlet');
import * as dotenv from 'dotenv';
import { connectRedis, redisClient } from './utilities/RedisClient';
import session from 'express-session';
import * as fs from 'fs';
import * as path from 'path';
import * as dns from 'dns';
import { RedisStore } from 'connect-redis';

// Fix Node 18+ DNS resolution for IPv6 hanging (googleapis.com timeout)
dns.setDefaultResultOrder('ipv4first');

const banner = async (name: string) => {
  return new Promise((resolve, reject) => {
    figlet.text(name, (err: any, data: any) => {
      if (err) {
        console.error('Something went wrong', err);
        reject(err);
        return;
      }
      console.log('' + data);
      resolve(data);
    });
  });
};

async function bootstrap() {
  const envCandidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '..', '.env'),
  ];
  let envLoaded = false;
  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      envLoaded = true;
      break;
    }
  }
  if (!envLoaded) {
    dotenv.config();
  }
  const bannerVal = process.env.BANNER;
  if (!bannerVal) {
    console.error('Banner went missing');
    return;
  }
  await banner(bannerVal);
  await connectRedis();
  const app = await NestFactory.create(AppModule);

  const isProd = process.env.NODE_ENV === 'production';
  const sessionCookieSecure = process.env.SESSION_COOKIE_SECURE === 'true';
  const sessionCookieSameSite =
    (process.env.SESSION_COOKIE_SAMESITE as
      | 'lax'
      | 'strict'
      | 'none'
      | undefined) ?? (sessionCookieSecure ? 'none' : 'lax');
  console.log('isProd:::', isProd);

  // Needed when app runs behind a reverse proxy (Nginx/ALB) and secure cookies are enabled.
  if (isProd && sessionCookieSecure) {
    const expressApp = app.getHttpAdapter().getInstance();
    if (typeof expressApp.set === 'function') {
      expressApp.set('trust proxy', 1);
    }
  }

  //Enable redis session
  const redisStore = new RedisStore({
    client: redisClient,
    ttl: 60 * 60, // 1 hour session TTL in Redis
  });
  app.use(
    session({
      name: 'sid',
      store: redisStore,
      secret:
        process.env.SESSION_SECRET ||
        'HCjsgERD9mlXno204D8F8UQrVjfVw8t3fjIqRgNoKC4lobDYPy2uAnvQe0p3YQUzKE3lsgc',
      resave: false,
      saveUninitialized: false,
      proxy: sessionCookieSecure,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: sessionCookieSecure,
        sameSite: sessionCookieSameSite,
        maxAge: 1000 * 60 * 60 * 1, //1 hr
      },
    }),
  );

  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || '127.0.0.1';
  await app.listen(Number(PORT), HOST);
  console.log(`🚀 Server is running on http://${HOST}:${PORT}`);
  console.log(`MeetsMadeEasy is initialized`);
}
bootstrap();
