import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';

export interface GoogleProfile {
  googleId: string;
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * Upsert a user by googleId — create on first login, update tokens on subsequent logins.
   */
  async validateUser(profile: GoogleProfile): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ googleId: profile.googleId }).exec();

    if (existing) {
      existing.accessToken = profile.accessToken;
      // Only update refreshToken if Google sends a new one — it only does so on first consent.
      if (profile.refreshToken) {
        existing.refreshToken = profile.refreshToken;
      }
      existing.email = profile.email;
      existing.displayName = profile.displayName;
      return existing.save();
    }

    return this.userModel.create({
      googleId: profile.googleId,
      email: profile.email,
      displayName: profile.displayName,
      accessToken: profile.accessToken,
      refreshToken: profile.refreshToken, // may be undefined on first call without prior consent
    });
  }

  /**
   * Retrieve a user's stored OAuth tokens by googleId.
   */
  async getUserByGoogleId(googleId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ googleId }).exec();
  }

  /**
   * Fallback: get the most recently authenticated user.
   * TODO: Replace with proper session/user tracking once available.
   */
  async getLatestUser(): Promise<UserDocument | null> {
    return this.userModel.findOne().sort({ updatedAt: -1 }).exec();
  }
}