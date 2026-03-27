import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google-auth/google.strategy';
import { User, UserSchema } from '../schemas/user.schema';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'google' }),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy],
  exports: [AuthService],
})
export class AuthModule {}
