import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { GoogleOAuthGuard } from './google-auth/google-oauth.guard';

@Controller('auth')
export class AuthController {
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  googleLogin() {} // redirects to Google consent screen

  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  googleCallback(@Req() req, @Res() res) {
    // Tokens are saved by GoogleStrategy.validate().
    // Persist googleId in session for subsequent authenticated API calls.
    const user = req.user;
    if (user?.googleId) {
      // Keep `userId` for backward compatibility while introducing explicit key.
      req.session.userId = user.googleId;
      req.session.googleId = user.googleId;
    }

    res.redirect('/dashboard');
  }
}
