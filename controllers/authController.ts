import User from "../models/auth";
import { isEmpty, reject } from "lodash";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
// import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid"; // For generating unique OTP ids
import StaticIds from "../models/staticIds";
import { generateToken } from "../utils/token-signer";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

const SECRET_KEY = "your_jwt_secret_key"; // Replace with a secure key
const OTP_EXPIRATION_TIME = 1 * 60 * 1000; // 5 minutes

let OTPStorage: any = {};

// Initialize Cloudinary configuration
cloudinary.config({
  cloud_name: "dmvudmx86",
  api_key: "737943533352822",
  api_secret: "LILUHv0IFf790mbLoXndhKki34E", // Use environment variable
});

export default class AuthController {
  static signUp = async (req: any, res: any) => {
    const payload = req.body;
    const { email } = payload;

    try {
      // Check if the email already exists in the database
      let checkEmailExists = await User.findOne({
        email: email,
      });

      if (!isEmpty(checkEmailExists)) {
        return res.send({ message: "This user is already exists" }); // Return here to stop execution
      }

      // Generate a 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Save OTP to in-memory storage (or use a database like Redis)
      const otpId = uuidv4(); // Generate a unique id for this OTP
      OTPStorage[email] = {
        email: payload.email,
        otp,
        expiresAt: Date.now() + OTP_EXPIRATION_TIME, // Expiry time
      };

      // Nodemailer setup
      const transporter = nodemailer.createTransport({
        service: "gmail", // Use the service you prefer
        auth: {
          user: "omify24@gmail.com", // Replace with your email
          pass: "wwzx qwrr gjme jpqa", // Replace with your email password
        },
      });

      // Send the OTP email
      await transporter.sendMail({
        from: '"Omify" <omify24@gmail.com>', // Sender's name and email
        to: payload.email,
        subject: "Your OTP Code",
        text: `Your OTP code is ${otp}. It will expire in 1 minute.`,
      });

      // Send success response after OTP is sent
      return res.send({ message: "OTP sent successfully.", otpId }); // Use return here to stop execution
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .send({ message: "Failed to send OTP. Please try again." });
    }
  };

  static async resendOtp(req: any, res: any) {
    const { email } = req.body;

    if (!email) {
      return res.status(400).send({ message: "Email is required." });
    }

    try {
      // Check if there's an existing OTP and if it has expired
      const storedOTP = OTPStorage[req.body.email];

      if (storedOTP) {
        delete OTPStorage[req.body.email];
      }

      // Generate a new OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Save the new OTP to in-memory storage
      const otpId = uuidv4(); // Generate a unique id for this OTP
      OTPStorage[email] = {
        email: email,
        otp,
        expiresAt: Date.now() + OTP_EXPIRATION_TIME, // Set expiry time (e.g., 1 minute)
      };

      // Nodemailer setup
      const transporter = nodemailer.createTransport({
        service: "gmail", // Use the service you prefer
        auth: {
          user: "omify24@gmail.com", // Replace with your email
          pass: "wwzx qwrr gjme jpqa", // Replace with your email password
        },
      });

      // Send the OTP email
      await transporter.sendMail({
        from: '"Omify" <omify24@gmail.com>', // Sender's name and email
        to: email,
        subject: "Your OTP Code",
        text: `Your OTP code is ${otp}. It will expire in 1 minute.`,
      });

      // Send success response with new OTP ID
      return res.send({ message: "OTP sent successfully.", otpId });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .send({ message: "Failed to resend OTP. Please try again." });
    }
  }

  static async verifyOtp(req: any, res: any) {
    if (!req.body.otpId) {
      return res.send({ message: "OTP is required." });
    }

    try {
      // Check if OTP exists and is valid
      const storedOTP = OTPStorage[req.body.email];
      if (!storedOTP || Number(storedOTP.otp) !== Number(req.body.otpId)) {
        return res.send({ message: "Invalid OTP." });
      }

      let data = await User.findOne({ email: req.body.email });

      if (!data) {
        const lastCreatedUserId = await StaticIds.find({}).limit(1).exec();
        const newUserId = String(parseInt(lastCreatedUserId[0].userId) + 1);
        await StaticIds.findOneAndUpdate({}, { userId: newUserId });
        // req.body.userName = `ADMIN`;
        // req.body.role = "ADMIN";
        req.body.userName = `USER${newUserId}`;
        req.body.role = "USER";
        req.body.status = "INACTIVE";
        delete OTPStorage[req.body.email];
        let newUser = await User.create(req.body);
        if (newUser) {
          const payload = {
            userId: newUser?.userName,
            role: newUser?.role,
          };
          const token = await generateToken(payload);
          const result = { user: newUser, token: token };

          res.send({ result: result });
        }
      } else {
        const payload = {
          userId: data.userName,
          role: data.role,
        };
        const token = await generateToken(payload);
        const result = { user: data, token: token };
        res.send({ result: result });
      }
      // res.send({ message: "User created successfully." });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .send({ message: "Failed to verify OTP. Please try again." });
    }
  }

  static login = async (req: any, res: any) => {
    const payload = req.body;
    try {
      const { email } = payload;
      let checkEmailExists = await User.findOne({
        email: email,
      });
      if (checkEmailExists) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP to in-memory storage (or use a database like Redis)
        const otpId = uuidv4(); // Generate a unique id for this OTP
        OTPStorage[email] = {
          email: payload.email,
          otp,
          expiresAt: Date.now() + OTP_EXPIRATION_TIME, // Expiry time
        };

        // Nodemailer setup
        const transporter = nodemailer.createTransport({
          service: "gmail", // Use the service you prefer
          auth: {
            user: "omify24@gmail.com", // Replace with your email
            pass: "wwzx qwrr gjme jpqa", // Replace with your email password
          },
        });

        // Send the OTP email
        await transporter.sendMail({
          from: '"Omify" <omify24@gmail.com>', // Sender's name and email
          to: payload.email,
          subject: "Your OTP Code",
          text: `Your OTP code is ${otp}. It will expire in 1 minute.`,
        });
        return res.send({ message: "OTP sent successfully.", otpId }); // Send the otpId to the client for verification
      } else {
        if (payload?.userId) {
          let checkUserIdExists = await User.findOne({
            userName: payload?.userId,
          });
          if (!checkUserIdExists) {
            return res.send({ message: "Getting Invalid UserName." });
          }
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP to in-memory storage (or use a database like Redis)
        const otpId = uuidv4(); // Generate a unique id for this OTP
        OTPStorage[email] = {
          email: payload.email,
          otp,
          expiresAt: Date.now() + OTP_EXPIRATION_TIME, // Expiry time
        };

        // Nodemailer setup
        const transporter = nodemailer.createTransport({
          service: "gmail", // Use the service you prefer
          auth: {
            user: "omify24@gmail.com", // Replace with your email
            pass: "wwzx qwrr gjme jpqa", // Replace with your email password
          },
        });

        // Send the OTP email
        await transporter.sendMail({
          from: '"Omify" <omify24@gmail.com>', // Sender's name and email
          to: payload.email,
          subject: "Your OTP Code",
          text: `Your OTP code is ${otp}. It will expire in 1 minute.`,
        });
        return res.send({ message: "OTP sent successfully.", otpId }); // Send the otpId to the client for verification
      }
    } catch (err) {
      return res.send({ message: err });
    }
  };

  static countAllUsers = async (req: any, res: any) => {
    const counts = await User.aggregate([
      {
        $match: {
          role: "USER",
        },
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

  static getAllUserDetails = async (req: any, res: any) => {
    try {
      const status = req.query.status;
      const pageNo = req.query?.pageNo;
      const pageSize = req.query?.pageSize;
      let getAllData = await User.find({ role: "USER", status })
        .sort({ createdAt: -1 }) // Sort in descending order
        .skip(pageNo * pageSize)
        .limit(pageSize);
      return res.send({ result: getAllData });
    } catch (err) {
      return res.send({ message: err });
    }
  };

  static getUserDataById = async (req: any, res: any) => {
    let userName = req.query.userName;

    try {
      // Correct the query with the trimmed and formatted phoneNumber
      let userDetail = await User.findOne({
        userName,
      });
      return res.send(userDetail);
    } catch (err) {
      console.error(err);
      return res.send({ message: err });
    }
  };

  static updateStaticId = async (req: any, res: any) => {
    let payload = req.body;
    try {
      let result = StaticIds.create(payload);
      return res.send(result);
    } catch (err) {
      return res.send({ message: err });
    }
  };

  static getUserDataByUserName = async (req: any, res: any) => {
    let userName = req?.user?.userId;
    let role = req?.user?.role;
    try {
      let result = await User.findOne({ userName, role });
      return res.send({ result: result });
    } catch (err) {
      return res.send({ message: err });
    }
  };

  static updateUserProfileByUserName = async (req: any, res: any) => {
    let payload = req?.body;
    const checkUserExists = User.findOne({
      userName: payload?.userName,
    });
    if (!checkUserExists) {
      res.send({ message: "No User Exists" });
    }
    const data = {
      name: payload?.name,
      phoneNumber: `+91${payload?.phoneNumber?.slice(-10)}`,
      socialLinkSelected: payload?.socialLinkSelected,
      socialLink: payload?.socialLink,
    };
    try {
      let result = await User.findOneAndUpdate(
        { userName: payload?.userName },
        { $set: data },
        { new: true }
      );
      return res.send({ result: result });
    } catch (err) {
      return res.send({ message: err });
    }
  };

  static updateKycByUserName = async (req: any, res: any) => {
    let payload = req?.body;
    const checkUserExists = User.findOne({
      userName: payload?.userName,
    });
    if (!checkUserExists) {
      res.send({ message: "No User Exists" });
    }
    const data = {
      adhaarCardNumber: payload?.adhaarCardNumber,
      panCardNumber: payload?.panCardNumber,
      accountHolderName: payload?.accountHolderName,
      ifscCode: payload?.ifscCode,
      accountNumber: payload?.accountNumber,
    };
    try {
      let result = await User.findOneAndUpdate(
        { userName: payload?.userName },
        { $set: data },
        { new: true }
      );
      return res.send({ result: result });
    } catch (err) {
      return res.send({ message: err });
    }
  };

  static uploadPanCardImage = async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).send("No file uploaded.");
      }

      // Validate it's an image
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: "Only image files are allowed" });
      }

      // Convert buffer to base64 for Cloudinary
      const fileStr = `data:${
        req.file.mimetype
      };base64,${req.file.buffer.toString("base64")}`;

      const uploadResult = await cloudinary.uploader.upload(fileStr, {
        public_id: `pan_card_${Date.now()}`,
        quality: "auto:best",
        fetch_format: "auto",
        width: 1500,
        height: 1500,
        crop: "limit",
        format: "jpg",
        transformation: [
          {
            quality: "80",
            dpr: "auto",
          },
        ],
      });

      const authDetails = await User.findOneAndUpdate(
        { userName: req.body.userName },
        { $set: { panCardImage: uploadResult?.secure_url } },
        { new: true }
      );

      return res.status(200).json({
        message: "File uploaded successfully",
        url: uploadResult.secure_url,
      });
    } catch (err) {
      console.error("PAN card upload error:", err);
      return res.status(500).json({ error: err.message });
    }
  };

  static uploadCancelCheckImage = async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).send("No file uploaded.");
      }

      // Validate it's an image
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: "Only image files are allowed" });
      }

      // Convert buffer to base64 for Cloudinary
      const fileStr = `data:${
        req.file.mimetype
      };base64,${req.file.buffer.toString("base64")}`;

      const uploadResult = await cloudinary.uploader.upload(fileStr, {
        public_id: `cancel_check_${Date.now()}`,
        quality: "auto:best",
        fetch_format: "auto",
        width: 1500,
        height: 1500,
        crop: "limit",
        format: "jpg",
        transformation: [
          {
            quality: "80",
            dpr: "auto",
          },
        ],
      });

      const authDetails = await User.findOneAndUpdate(
        { userName: req.body.userName },
        { $set: { cancelCheckImage: uploadResult?.secure_url } },
        { new: true }
      );

      return res.status(200).json({
        message: "File uploaded successfully",
        url: uploadResult.secure_url,
      });
    } catch (err) {
      console.error("Cancel check upload error:", err);
      return res.status(500).json({ error: err.message });
    }
  };

  static updateUserStatus = async (req: any, res: any) => {
    try {
      const { userName, status } = req.body;
      const statusUpdate = await User.findOneAndUpdate(
        { userName },
        { $set: { status } },
        { new: true }
      );

      if (!statusUpdate) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Status updated successfully",
        user: statusUpdate,
      });
      return res.send(statusUpdate);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };
}
