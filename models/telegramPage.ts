import { model, Schema, Types } from 'mongoose';

export interface IPlans {
  _id?: Types.ObjectId;
  price?: number;
  discount?: number;
  totalNumber?: number;
  value?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
export interface ITelegramPage {
  _id?: Types.ObjectId;
  channelName: string;
  channelId: string;
  channelLink: string;
  userName: string;
  title: number;
  description: string;
  status: string;
  phoneNumber: string;
  buttonText: string;
  category: string;
  imageUrl: string;
  plans: IPlans
  createdAt?: Date;
  updatedAt?: Date;
}

const plansSchema: Schema = new Schema(
  {
    price: {
      type: Number,
    },
    discount: {
      type: Number,
    },
    totalNumber: {
      type: Number,
    },
    value: {
      type: String,
    },
  },
  {
    timestamps: true,
    strict: true
  }
);

const telegramPageSchema: Schema = new Schema(
  {
    channelName: {
      type: String,
    },
    channelId: {
      type: String,
    },
    channelLink: {
      type: String,
    },
    userName: {
      type: String,
    },
    title: {
      type: String,
    },
    description: {
      type: String,
    },
    status: {
      type: String,
      default: 'INACTIVE'
    },
    phoneNumber: {
      type: String,
    },
    buttonText: {
      type: String,
    },
    category: {
      type: String,
    },
    imageUrl: {
      type: String,
    },
    plans: {
      type: [plansSchema],
    }
  },
  {
    timestamps: true,
    strict: true
  }
);

const TelegramPage = model<ITelegramPage>('telegramPage', telegramPageSchema);

export default TelegramPage;