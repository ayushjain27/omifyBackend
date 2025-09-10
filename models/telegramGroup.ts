import { model, Schema, Types } from 'mongoose';

export interface ITelegramGroup {
  _id?: Types.ObjectId;
  groupId: string;
  title: string;
  memberCount: number;
  adminPhone: string;
  createdBy: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const telegramGroupSchema: Schema = new Schema(
  {
    groupId: {
      type: String,
      required: true,
      unique: true
    },
    title: {
      type: String,
      required: true
    },
    memberCount: {
      type: Number,
      default: 0
    },
    adminPhone: {
      type: String,
      required: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true,
    strict: false // Allows saving extra fields even if not defined in the schema
  }
);

const TelegramGroup = model<ITelegramGroup>('TelegramGroup', telegramGroupSchema);

export default TelegramGroup;