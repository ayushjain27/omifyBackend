import { Document, Model, model, Schema, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  phoneNumber?: string;
  role?: string;
  email?: string;
  userId?: string;
  userName?: string;
  status?: string;
  adhaarCardNumber?: string;
  panCardNumber?: string;
  name?: string;
  accountHolderName?: string,
  ifscCode?: string,
  accountNumber?: string,
  socialLinkSelected?: string,
  socialLink?: string,
  panCardImage?: string,
  cancelCheckImage?: string 
}

const userSchema: Schema = new Schema(
  {
    name: {
      type: String
    },
    phoneNumber: {
      type: String
    },
    role: {
      type: String
    },
    email: {
      type: String
    },
    userName: {
      type: String
    },
    userId: {
      type: String
    },
    status: {
      type: String
    },
    adhaarCardNumber: {
      type: String
    },
    panCardNumber: {
      type: String
    },
    accountHolderName: {
      type: String
    },
    ifscCode: {
      type: String
    },
    accountNumber: {
      type: String
    },
    socialLinkSelected: {
      type: String
    },
    socialLink: {
      type: String
    },
    panCardImage: {
      type: String
    },
    cancelCheckImage: {
      type: String
    }
  },
  { timestamps: true }
);

const User = model<IUser & Document>('users', userSchema);

export default User;
