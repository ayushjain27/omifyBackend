import { model, Schema, Types } from 'mongoose';

export interface ITelegramUser {
  _id?: Types.ObjectId;
  phoneNumber: string;
  verified: boolean;
  verifiedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const telegramUserSchema: Schema = new Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      unique: true
    },
    verified: {
      type: Boolean,
      default: false
    },
    verifiedAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    strict: false // Allows saving extra fields even if not defined in the schema
  }
);

const TelegramUser = model<ITelegramUser>('TelegramUser', telegramUserSchema);

export default TelegramUser;