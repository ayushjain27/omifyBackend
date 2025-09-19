import { model, Schema, Types } from 'mongoose';

export interface ITelegramNewUser {
  _id?: Types.ObjectId;
  userId: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  username?: string;
  registeredAt?: Date;
  lastUpdated?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const TelegramNewUserSchema = new Schema({
  userId: {
    type: Number
  },
  phoneNumber: {
    type: String,
    required: true
  },
  firstName: {
    type: String
  },
  lastName: {
    type: String,
    default: ''
  },
  username: {
    type: String,
    default: ''
  },
  registeredAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

const TelegramNewUser = model('TelegramNewUser', TelegramNewUserSchema);

export default TelegramNewUser;