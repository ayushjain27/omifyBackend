import { model, Schema, Types } from 'mongoose';

export interface IPaymentPage {
  _id?: Types.ObjectId;
  status: string;
  phoneNumber?: string;
  price?: string;
  pageTitle?: string;
  category?: string;
  description?: string;
  buttonText?: string;
  imageUrl?: string;
  file?: string;
  link?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const paymentSchema: Schema = new Schema(
  {
    status: {
      type: String,
      default: 'INACTIVE'
    },
    phoneNumber: {
      type: String,
      required: true
    },
    price: {
      type: String
    },
    pageTitle: {
      type: String
    },
    category: {
      type: String
    },
    description: {
      type: String
    },
    buttonText: {
      type: String
    },
    imageUrl: {
      type: String
    },
    file: {
      type: String
    },
    link: {
      type: String
    }
  },
  {
    timestamps: true,
    strict: false // Allows saving extra fields even if not defined in the schema
  }
);

const PaymentPage = model<IPaymentPage>('paymentPage', paymentSchema);

export default PaymentPage;
