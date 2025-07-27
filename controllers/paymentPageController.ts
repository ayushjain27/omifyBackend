import { Types } from "mongoose";
import PaymentPage from "../models/paymentPage";
import { isEmpty, reject } from "lodash";
import path from "path";
import fs from "fs";
import User from "../models/auth";
import UserDetailsPage from "../models/user";
import { v2 as cloudinary } from "cloudinary";
import razorpay from "razorpay";
import axios from "axios";

// Initialize Cloudinary configuration
cloudinary.config({
  cloud_name: "dmvudmx86",
  api_key: "737943533352822",
  api_secret: "LILUHv0IFf790mbLoXndhKki34E", // Use environment variable
});

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
    let { paymentId, status } = payload;
    try {
      let paymentPage = await PaymentPage.findOne({
        _id: new Types.ObjectId(paymentId),
      });
      if (isEmpty(paymentPage)) {
        res.send({ message: "Payment Page not Found" });
      }
      let updatedData = await PaymentPage.findOneAndUpdate(
        { _id: paymentId }, // Query condition
        { $set: { status } }, // Update fields
        { new: true } // Return updated document
      );
      return res.send(updatedData);
    } catch (err) {
      return res.send({ message: err });
    }
  };

  static createUserPaymentDetails = async (req: any, res: any) => {
    let payload = req.body;
    payload.phoneNumber = `+91${payload.phoneNumber.slice(-10)}`;
    try {
      let userDetailsPayment = UserDetailsPage.create(payload);
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

        // Validate it's an image
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({ error: "Only image files are allowed" });
        }

        // Convert buffer to base64 for Cloudinary
        const fileStr = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

        const uploadResult = await cloudinary.uploader.upload(fileStr, {
            public_id: `img_${Date.now()}`,
            quality: 'auto:best',
            fetch_format: 'auto',
            width: 1500,
            height: 1500,
            crop: 'limit',
            format: 'jpg',
            transformation: [{
                quality: '80',
                dpr: 'auto'
            }]
        });

        const paymentPage = await PaymentPage.findOneAndUpdate(
            { _id: req.body.paymentPageId },
            { $set: { imageUrl: uploadResult?.secure_url } },
            { new: true }
        );

        return res.status(200).json({ 
            message: "File uploaded successfully",
            url: uploadResult.secure_url 
        });
    } catch (err) {
        console.error("Upload error:", err);
        return res.status(500).json({ error: err.message });
    }
};

static uploadAnything = async (req: any, res: any) => {
  try {
      if (!req.file) {
          return res.status(400).send("No file uploaded.");
      }

      console.log(req.file, "Uploaded file info");
      
      // Since we're using memory storage, we need to handle the buffer
      const fileBuffer = req.file.buffer;
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      
      const options: any = {
          resource_type: 'auto',
          public_id: `doc_${Date.now()}`,
          quality: 'auto:good',
          fetch_format: 'auto',
      };

      // Special handling for different file types
      if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(fileExtension)) {
          options.quality_analysis = true;
          options.transformation = [
              { width: 1000, height: 1000, crop: 'limit' }
          ];
      } else if (['.pdf'].includes(fileExtension)) {
          options.resource_type = 'raw';
          options.format = 'pdf';
      } else if (['.xls', '.xlsx', '.csv'].includes(fileExtension)) {
          options.resource_type = 'raw';
      } else if (['.mp4', '.mov', '.avi'].includes(fileExtension)) {
          options.resource_type = 'video';
          options.quality = 'auto:good';
          options.bit_rate = '500k';
      }

      // Convert buffer to a format Cloudinary can accept
      const fileStr = `data:${req.file.mimetype};base64,${fileBuffer.toString('base64')}`;

      // Upload to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(fileStr, options);

      const paymentPage = await PaymentPage.findOneAndUpdate(
          { _id: req.body.paymentPageId },
          { $set: { file: uploadResult?.secure_url } },
          { new: true }
      );

      return res.status(200).json({ 
          message: "File uploaded successfully",
          url: uploadResult.secure_url 
      });
  } catch (err) {
      console.error("Upload error:", err);
      return res.status(500).json({ error: err.message });
  }
};

  static getPaymentPageDetailById = async (req: any, res: any) => {
    const paymentPageId = req.query.id;
    let query = {
      _id: new Types.ObjectId(paymentPageId),
    };
    let paymentDetails = await PaymentPage.aggregate([
     { $match: query },
      {
        $lookup: {
          from: 'users',
          localField: 'userName',
          foreignField: 'userName',
          as: 'userDetails'
        }
      },
      { $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true } },
    ]);
    return res.send(paymentDetails[0]);
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
          rejected: [{ $match: { status: "REJECTED" } }, { $count: "count" }],
        },
      },
    ]);

    // Extract the counts from the aggregation result
    const result = {
      total: counts[0]?.total[0]?.count || 0,
      active: counts[0]?.active[0]?.count || 0,
      inActive: counts[0]?.inactive[0]?.count || 0,
      rejected: counts[0]?.rejected[0]?.count || 0,
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


  static countAllUsersDataByUserName = async (req: any, res: any) => {
    const counts = await UserDetailsPage.aggregate([
      {
        $match: {
          userName: req?.query?.userName
        },
      },
      {
        $facet: {
          total: [{ $count: "count" }],
          // active: [{ $match: { status: "ACTIVE" } }, { $count: "count" }],
          // inactive: [{ $match: { status: "INACTIVE" } }, { $count: "count" }],
          // rejected: [{ $match: { status: "REJECTED" } }, { $count: "count" }],
        },
      },
    ]);

    // Extract the counts from the aggregation result
    const result = {
      total: counts[0]?.total[0]?.count || 0,
      // active: counts[0]?.active[0]?.count || 0,
      // inActive: counts[0]?.inactive[0]?.count || 0,
      // rejected: counts[0]?.rejected[0]?.count || 0,
    };
    return res.send(result);
  };

  static getAllUsersDataByUserName = async (req: any, res: any) => {
    try {
      const userName = req.query.userName;
      const pageNo = req.query?.pageNo;
      const pageSize = req.query?.pageSize;
      let getAllData = await UserDetailsPage.find({ userName })
        .sort({ createdAt: -1 }) // Sort in descending order
        .skip(pageNo * pageSize)
        .limit(pageSize);
      return res.send({ result: getAllData });
    } catch (err) {
      return res.send({ message: err });
    }
  };
};


