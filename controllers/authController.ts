import User from "../models/auth";
import { isEmpty } from "lodash";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
// import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid"; // For generating unique OTP ids

const SECRET_KEY = "your_jwt_secret_key"; // Replace with a secure key
const OTP_EXPIRATION_TIME = 1 * 60 * 1000; // 5 minutes

let OTPStorage: any = {}

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
      return res.status(500).send({ message: "Failed to send OTP. Please try again." });
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
  
      if (storedOTP){
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
      return res.status(500).send({ message: "Failed to resend OTP. Please try again." });
    }
  }
  
  

  static async verifyOtp(req: any, res: any) {
    if (isEmpty(req.body.otpId)) {
      return res.status(400).send({ message: "OTP is required." });
    }

    try {
      // Check if OTP exists and is valid
      const storedOTP = OTPStorage[req.body.email];
      if (!storedOTP || storedOTP.otp !== req.body.otpId) {
      return res.status(400).send({ message: "Invalid or expired OTP." });
      }

      const currentDate = Date.now();
      // If the OTP has expired, delete it from OTPStorage and return an error
      if (currentDate > storedOTP.expiresAt) {
        delete OTPStorage[req.body.email]; // Remove expired OTP
        return res.status(400).send({ message: "OTP has expired." });
      }

      console.log(req.body,"dle,")
      let data = await User.findOne({ email: req.body.email });
      console.log(data,"denjnk")

      if(!isEmpty(data)){
        console.log("dmk")
        return res.send(data);
      }
      console.log("dmkfef")
      
      // OTP is valid; create a new user
      //   const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await User.create({
        phoneNumber: `+91${req.body.phoneNumber.slice(-10)}`,
        email: req.body.email,
        name: req.body.name,
        status: 'INACTIVE'
        // password: hashedPassword,
      });
      
      console.log("dmkffeef")
      // Generate a JWT token
      //   const token = jwt.sign({ id: newUser._id, email: newUser.email }, SECRET_KEY, {
      //     expiresIn: "1h", // Token valid for 1 hour
      //   });

      // Cleanup: Delete OTP after successful verification
      delete OTPStorage[req.body.email];
      return res.send(newUser);
      // res.send({ message: "User created successfully." });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .send({ message: "Failed to verify OTP. Please try again." });
    }
  }

  static login = async (req: any, res: any) => {
    console.log(req.body,"dfemkk")
    const payload = req.body;
    try {
      const { email } = payload;
      let checkEmailExists = await User.findOne({
        email: email,
      });
      console.log(checkEmailExists,"felmk")
      if (isEmpty(checkEmailExists)) {
        return res.send({ message: 'User does not exists'});
      } else {
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

  static getAllUserDetails = async (req: any, res: any) => {
    try {
      let getAllData = await User.find({});
      return res.send(getAllData);
    } catch (err) {
      return res.send({ message: err });
    }
  };

  static getUserDataById = async (req: any, res: any) => {
    let payload = req.query;
    let { phoneNumber } = payload;

    const newPhoneNumber =  `+91${phoneNumber.slice(-10)}`;
  
    try {
      // Correct the query with the trimmed and formatted phoneNumber
      let userDetail = await User.findOne({
        phoneNumber: newPhoneNumber
      });
      console.log(userDetail,"userDetail")
      return res.send(userDetail);
    } catch (err) {
      console.error(err);
      return res.send({ message: err });
    }
  };

  static updateUSerStatus = async (req: any, res: any) => {
    let payload = req.body;
    let { phoneNumber } = payload;
    try {
      const newPhoneNumber =  `+91${phoneNumber.slice(-10)}`;
      console.log(newPhoneNumber,"dmk")
      let userDetail = await User.findOne({
        phoneNumber: newPhoneNumber,
      });
      if(isEmpty(userDetail)){
        res.send({message: 'User not Found'})
      }
      let updatedData = await User.findOneAndUpdate({
        phoneNumber:newPhoneNumber,
        $set: {status: 'ACTIVE'}
      })
      return res.send(updatedData);
    } catch (err) {
      return res.send({ message: err });
    }
  };
}
