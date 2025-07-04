import { Types } from "mongoose";
import PaymentPage from "../models/paymentPage";
import { isEmpty } from "lodash";
import path from "path";
import fs from "fs";
import User from "../models/auth";
import UserDetailsPage from "../models/user";
import razorpay from "razorpay";
import axios from "axios";

export default class PaymentPageController {
  static createPaymentPage = async (req: any, res: any) => {
    const payload = req.body;
    try {
      const response = await PaymentPage.create(payload);
      return res.send(response);
    } catch (err) {
      return res.send({ message: err });
    }
  };

  static updatePaymentPage = async (req: any, res: any) => {
    const paymentPageId = req.params.paymentPageId;
    const payload = req.body;
    let paymentPageData;
    if (paymentPageId) {
      paymentPageData = await PaymentPage.findOne({
        _id: paymentPageId,
      });
    }
    if (isEmpty(paymentPageData)) {
      throw new Error("Page Not Found");
    }

    try {
      const response = await PaymentPage.findOneAndUpdate({
        _id: paymentPageId,
        ...payload,
      });
      return res.send(response);
    } catch (err) {
      return res.send({ message: err });
    }
  };

  static deletePaymentPage = async (req: any, res: any) => {
    const paymentPageId = req.params.paymentPageId;
    const payload = req.body;
    let paymentPageData;
    if (paymentPageId) {
      paymentPageData = await PaymentPage.findOne({
        _id: paymentPageId,
      });
    }
    if (isEmpty(paymentPageData)) {
      throw new Error("Page Not Found");
    }

    try {
      const response = await PaymentPage.findOneAndDelete({
        _id: paymentPageId,
      });
      return res.send(response);
    } catch (err) {
      return res.send({ message: err });
    }
  };

  static paymentDetailsListByPhoneNumber = async (req: any, res: any) => {
    let payload = req.query;
    let { phoneNumber } = payload;
    const newPhoneNumber = `+91${phoneNumber.slice(-10)}`;
    try {
      let getUserPaymentDetailsList = await PaymentPage.find({
        phoneNumber: newPhoneNumber,
      });
      return res.send(getUserPaymentDetailsList);
    } catch (err) {
      return res.send({ message: err });
    }
  };

  static getAllPaymentPages = async (req: any, res: any) => {
    const allPaymentPages = await PaymentPage.find({});
    res.send(allPaymentPages);
  };

  static updatePaymentStatus = async (req: any, res: any) => {
    let payload = req.body;
    let { paymentId } = payload;
    try {
      let paymentPage = await PaymentPage.findOne({
        _id: paymentId,
      });
      if (isEmpty(paymentPage)) {
        res.send({ message: "Payment Page not Found" });
      }
      let updatedData = await PaymentPage.findOneAndUpdate(
        { _id: paymentId }, // Query condition
        { $set: { status: "ACTIVE" } }, // Update fields
        { new: true } // Return updated document
      );
      return res.send(updatedData);
    } catch (err) {
      return res.send({ message: err });
    }
  };

  static createUserPaymentDetails = async (req: any, res: any) => {
    let payload = req.body;
    let { paymentPageId } = payload;
    try {
      let paymentPage = await PaymentPage.findOne({
        _id: paymentPageId,
      }).lean();
      if (isEmpty(paymentPage)) {
        res.send({ message: "Payment Page not Found" });
      }
      let reqBody = { ...payload };
      reqBody.sellerPhoneNumber = `+91${paymentPage?.phoneNumber.slice(-10)}`;

      let userDetails = await User.findOne({
        phoneNumber: `+91${reqBody.sellerPhoneNumber.slice(-10)}`,
      });
      if (isEmpty(userDetails)) {
        return res.send({ message: "User not Found" });
      }

      reqBody.sellerName = userDetails?.name;

      let userDetailsPayment = UserDetailsPage.create(reqBody);
      return res.send(userDetailsPayment);
    } catch (err) {
      return res.send({ message: err });
    }
  };

  static imageUpload = async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).send("No file uploaded.");
      }
      const filePath = `/tmp/uploads/${req.file.filename}`;
      const paymentPage = await PaymentPage.findOneAndUpdate(
        { _id: req.body.paymentPageId }, // Query object
        { $set: { imageUrl: filePath } }, // Update object
        { new: true } // Return the updated document
      );
      return res
        .status(200)
        .json({ message: "File uploaded successfully", filePath });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };

  static uploadAnything = async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).send("No file uploaded.");
      }
      const filePath = `/tmp/userUploadData/${req.file.filename}`;
      const paymentPage = await PaymentPage.findOneAndUpdate(
        { _id: req.body.paymentPageId }, // Query object
        { $set: { file: filePath } }, // Update object
        { new: true } // Return the updated document
      );
      return res
        .status(200)
        .json({ message: "File uploaded successfully", filePath });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };

  static getImages = async (req: any, res: any) => {
    try {
      const filePath = path.join("/tmp", "uploads", req.params.filename);

      if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
      } else {
        return res.status(404).send("File not found");
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };

  static getPaymentPageDetailById = async (req: any, res: any) => {
    const paymentPageId = req.query.id;
    let query = {
      _id: paymentPageId,
    };
    let paymentDetails = await PaymentPage.findOne(query);
    return res.send(paymentDetails);
  };

  static countAllPaymentPagesByUserName = async (req: any, res: any) => {
    const userName = req.query.userName;
    const query: any = {};
    if (userName !== "ADMIN") {
      query.userName = userName;
    }
    const counts = await PaymentPage.aggregate([
      {
        $match: query,
      },
      {
        $facet: {
          total: [{ $count: "count" }],
          active: [{ $match: { status: "ACTIVE" } }, { $count: "count" }],
          inactive: [{ $match: { status: "INACTIVE" } }, { $count: "count" }],
        },
      },
    ]);

    // Extract the counts from the aggregation result
    const result = {
      total: counts[0]?.total[0]?.count || 0,
      active: counts[0]?.active[0]?.count || 0,
      inActive: counts[0]?.inactive[0]?.count || 0,
    };
    return res.send(result);
  };

  static getAllPaymentPagesPaginated = async (req: any, res: any) => {
    const payload = req.body;
    const query: any = {
      status: payload.status,
    };
    if (payload.userName !== "ADMIN") {
      query.userName = payload.userName;
    }
    const pageNo = payload?.pageNo;
    const pageSize = payload?.pageSize;
    const result = await PaymentPage.find(query)
      .sort({ createdAt: -1 }) // Sort in descending order
      .skip(pageNo * pageSize)
      .limit(pageSize);
    return res.send(result);
  };

  static createQrCode = async (req: any, res: any) => {
    let payload = req.body;
    let { paymentPageId } = payload;
    try {
      let paymentPage = await PaymentPage.findOne({
        _id: paymentPageId,
      });
      if (isEmpty(paymentPage)) {
        res.send({ message: "Payment Page not Found" });
      }
      const fakeQrCodeData = {
        id: "qr_123456789",
        entity: "qr_code",
        name: "Test QR Code",
        usage: "single_use",
        status: "active",
        payment_amount: 50000, // 500 INR
        currency: "INR",
        image_url: "https://i.postimg.cc/vTk2c1SX/Scanner-Image.png",
      };

      // ✅ Send Fake QR Code Response
      return res.status(200).send(fakeQrCodeData);
      // let userDetailsPayment = UserDetailsPage.create(reqBody);
      // return res.send(qr);
    } catch (err) {
      return res.send({ message: err });
    }
  };
}
