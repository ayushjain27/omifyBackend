import { model, Schema, Types } from "mongoose";

export interface IUserDetailsPage {
  _id?: Types.ObjectId;
  name: string;
  email: string;
  phoneNumber: string;
  paymentPageId: string;
  userName: string;
  paymentAmount: string;
}

const userDetailsPageSchema: Schema = new Schema(
  {
    name: {
      type: String
    },
    email: {
        type: String
    },
    phoneNumber: {
        type: String
    },
    paymentPageId: {
        type: String
    },
    userName: {
        type: String
    },
    paymentAmount: {
      type: String
    }
  },
  {
    timestamps: true,
    strict: false,
  }
);

const UserDetailsPage = model<IUserDetailsPage>("userDetailsPage", userDetailsPageSchema);

export default UserDetailsPage;
