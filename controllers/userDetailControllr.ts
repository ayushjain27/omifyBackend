import { Types } from "mongoose";
import PaymentPage from "../models/paymentPage";
import { isEmpty } from "lodash";
import path from "path";
import fs from "fs";
import User from "../models/auth";
import UserDetailsPage from "../models/user";

export default class UserPageController {
  static getAllPaymentUserDetails = async (req: any, res: any) => {
    let payload = req.query;
    let { phoneNumber } = payload;
    const newPhoneNumber = `+91${phoneNumber.slice(-10)}`;
    console.log(newPhoneNumber, "demlm");
    try {
      let getUserPaymentList = await UserDetailsPage.aggregate([
        {
          $match: { sellerPhoneNumber: newPhoneNumber } // Correctly filter documents
        },
        {
          $lookup: {
            from: 'paymentpages',
            let: { paymentPageId: { $toObjectId: "$paymentPageId" } }, // Convert to ObjectId
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $eq: ["$_id", "$$paymentPageId"] // Match ObjectId
                        }
                    }
                }
            ],
            as: 'paymentDetails'
          },
        },
        { $unwind: { path: '$paymentDetails' } },
      ]);
      return res.send(getUserPaymentList);
    } catch (err) {
      return res.send({ message: err });
    }
  };
}
