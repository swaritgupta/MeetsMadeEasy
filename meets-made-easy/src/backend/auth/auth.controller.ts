import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { GoogleOAuthGuard } from './google-oauth.guard';

@Controller('auth')
export class AuthController {
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  googleLogin() {} // redirects to Google consent screen

  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  googleCallback(@Req() req, @Res() res) {
    // Tokens are saved by the GoogleStrategy.validate() method.
    // Store the googleId in a cookie so we can identify the user in later requests.
    const user = req.user;
    if (user?.googleId) {
      res.cookie('googleId', user.googleId, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    }
    res.redirect('/dashboard');
  }
}