import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      scope: [
        'email',
        'profile',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/calendar',        
        'https://www.googleapis.com/auth/calendar.events'
      ],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<void> {
    const user = await this.authService.validateUser({
      googleId: profile.id,
      email: profile.emails?.[0]?.value ?? '',
      displayName: profile.displayName ?? '',
      accessToken,
      refreshToken,
    });

    done(null, user);
  }
}