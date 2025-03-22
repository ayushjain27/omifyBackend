import { Types } from "mongoose";
import PaymentPage from "../models/paymentPage";
import { isEmpty } from "lodash";
import path from "path";
import fs from 'fs';
import User from "../models/auth";
import UserDetailsPage from "../models/user";
import razorpay from 'razorpay';
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
    console.log(newPhoneNumber, "demlm");
    try {
      let getUserPaymentDetailsList = await PaymentPage.find({
        phoneNumber: newPhoneNumber,
      });
      return res.send(getUserPaymentDetailsList);
    } catch (err) {
      return res.send({ message: err });
    }
  };

  static getAllPaymentPages = async(req: any, res: any) => {
    const allPaymentPages = await PaymentPage.find({});
    res.send(allPaymentPages);
  }

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
        { _id: paymentId },  // Query condition
        { $set: { status: "ACTIVE" } },  // Update fields
        { new: true }  // Return updated document
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

      let userDetails = await User.findOne({ phoneNumber: `+91${reqBody.sellerPhoneNumber.slice(-10)}` });
      if(isEmpty(userDetails)){
        return res.send({ message: "User not Found" });
      }

      reqBody.sellerName = userDetails?.name

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
      const filePath = `/uploads/${req.file.filename}`;
      console.log(req.body.paymentPageId, "frmnk");
      const paymentPage = await PaymentPage.findOneAndUpdate(
        { _id: req.body.paymentPageId }, // Query object
        { $set: { imageUrl: filePath } }, // Update object
        { new: true } // Return the updated document
      );
      
      console.log(paymentPage,'dlefl')
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
      const filePath = `/userUploadData/${req.file.filename}`;
      console.log(req.body.paymentPageId, "frmnk");
      const paymentPage = await PaymentPage.findOneAndUpdate(
        { _id: req.body.paymentPageId }, // Query object
        { $set: { file: filePath } }, // Update object
        { new: true } // Return the updated document
      );
      
      console.log(paymentPage,'dlefl')
      return res
        .status(200)
        .json({ message: "File uploaded successfully", filePath });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };

  static getImages = async (req: any, res: any) => {
    try {
      const { filename } = req.params; // Extract filename from the request params
      const filePath = path.join(__dirname, '../uploads', filename); // Path to the file
      console.log(filePath,"dlem")
  
      // Check if the file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).send({ error: "File not found." });
      }
  
      // Serve the file
      return res.sendFile(filePath);
      // return res
      //   .status(200)
      //   .json({ message: "File uploaded successfully", filePath });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };

  static getPaymentPageDetailById = async (req: any, res: any) => {
    const paymentPageId = req.query.id;
    console.log(req.query,"drmfk")
    let query = {
      _id: paymentPageId
    }
    let paymentDetails = await PaymentPage.findOne(query);
    return res.send(paymentDetails);
  }

  static createQrCode = async (req: any, res: any) => {
    let payload = req.body;
    let { paymentPageId } = payload;
    console.log(paymentPageId,"paymentPageId")
    try {
      let paymentPage = await PaymentPage.findOne({
        _id: paymentPageId,
      });
      console.log(paymentPage,"fmrknfknrk")
      if (isEmpty(paymentPage)) {
        res.send({ message: "Payment Page not Found" });
      }
      console.log("mfkrmkkk")
      const fakeQrCodeData = {
        id: "qr_123456789",
        entity: "qr_code",
        name: "Test QR Code",
        usage: "single_use",
        status: "active",
        payment_amount: 50000, // 500 INR
        currency: "INR",
        image_url: "https://i.postimg.cc/vTk2c1SX/Scanner-Image.png"
      };

      // ✅ Send Fake QR Code Response
      return res.status(200).send(fakeQrCodeData);
      // let userDetailsPayment = UserDetailsPage.create(reqBody); 
      // return res.send(qr);
    } catch (err) {
      console.log(err,"dmekmfk")
      return res.send({ message: err });
    }
  };

}
