import { model, Schema, Types } from "mongoose";

export interface IUserDetailsPage {
  _id?: Types.ObjectId;
  name: string;
  email: string;
  phoneNumber: string;
  paymentPageId: string;
  sellerName: string;
  sellerPhoneNumber: string;
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
    sellerName: {
        type: String
    },
    sellerPhoneNumber: {
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
