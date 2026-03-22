import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true })
  googleId!: string;

  @Prop({ required: true })
  email!: string;

  @Prop()
  displayName?: string;

  @Prop({ required: true })
  accessToken!: string;

  // refreshToken is only provided by Google on the very first consent.
  // It may be absent on subsequent logins, so it is optional here.
  @Prop()
  refreshToken?: string;

  createdAt?: Date;

  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
