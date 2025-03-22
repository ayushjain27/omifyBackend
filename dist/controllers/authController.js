"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = __importDefault(require("../models/auth"));
const lodash_1 = require("lodash");
const nodemailer_1 = __importDefault(require("nodemailer"));
// import bcrypt from "bcryptjs";
const uuid_1 = require("uuid"); // For generating unique OTP ids
const SECRET_KEY = "your_jwt_secret_key"; // Replace with a secure key
const OTP_EXPIRATION_TIME = 1 * 60 * 1000; // 5 minutes
let OTPStorage = {};
class AuthController {
    static resendOtp(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
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
                const otpId = (0, uuid_1.v4)(); // Generate a unique id for this OTP
                OTPStorage[email] = {
                    email: email,
                    otp,
                    expiresAt: Date.now() + OTP_EXPIRATION_TIME, // Set expiry time (e.g., 1 minute)
                };
                // Nodemailer setup
                const transporter = nodemailer_1.default.createTransport({
                    service: "gmail", // Use the service you prefer
                    auth: {
                        user: "omify24@gmail.com", // Replace with your email
                        pass: "wwzx qwrr gjme jpqa", // Replace with your email password
                    },
                });
                // Send the OTP email
                yield transporter.sendMail({
                    from: '"Omify" <omify24@gmail.com>', // Sender's name and email
                    to: email,
                    subject: "Your OTP Code",
                    text: `Your OTP code is ${otp}. It will expire in 1 minute.`,
                });
                // Send success response with new OTP ID
                return res.send({ message: "OTP sent successfully.", otpId });
            }
            catch (error) {
                console.error(error);
                return res.status(500).send({ message: "Failed to resend OTP. Please try again." });
            }
        });
    }
    static verifyOtp(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            if ((0, lodash_1.isEmpty)(req.body.otpId)) {
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
                console.log(req.body, "dle,");
                let data = yield auth_1.default.findOne({ email: req.body.email });
                console.log(data, "denjnk");
                if (!(0, lodash_1.isEmpty)(data)) {
                    console.log("dmk");
                    return res.send(data);
                }
                console.log("dmkfef");
                // OTP is valid; create a new user
                //   const hashedPassword = await bcrypt.hash(password, 10);
                const newUser = yield auth_1.default.create({
                    phoneNumber: `+91${req.body.phoneNumber.slice(-10)}`,
                    email: req.body.email,
                    name: req.body.name,
                    status: 'INACTIVE'
                    // password: hashedPassword,
                });
                console.log("dmkffeef");
                // Generate a JWT token
                //   const token = jwt.sign({ id: newUser._id, email: newUser.email }, SECRET_KEY, {
                //     expiresIn: "1h", // Token valid for 1 hour
                //   });
                // Cleanup: Delete OTP after successful verification
                delete OTPStorage[req.body.email];
                return res.send(newUser);
                // res.send({ message: "User created successfully." });
            }
            catch (error) {
                console.error(error);
                return res
                    .status(500)
                    .send({ message: "Failed to verify OTP. Please try again." });
            }
        });
    }
}
_a = AuthController;
AuthController.signUp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = req.body;
    const { email } = payload;
    try {
        // Check if the email already exists in the database
        let checkEmailExists = yield auth_1.default.findOne({
            email: email,
        });
        if (!(0, lodash_1.isEmpty)(checkEmailExists)) {
            return res.send({ message: "This user is already exists" }); // Return here to stop execution
        }
        // Generate a 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        // Save OTP to in-memory storage (or use a database like Redis)
        const otpId = (0, uuid_1.v4)(); // Generate a unique id for this OTP
        OTPStorage[email] = {
            email: payload.email,
            otp,
            expiresAt: Date.now() + OTP_EXPIRATION_TIME, // Expiry time
        };
        // Nodemailer setup
        const transporter = nodemailer_1.default.createTransport({
            service: "gmail", // Use the service you prefer
            auth: {
                user: "omify24@gmail.com", // Replace with your email
                pass: "wwzx qwrr gjme jpqa", // Replace with your email password
            },
        });
        // Send the OTP email
        yield transporter.sendMail({
            from: '"Omify" <omify24@gmail.com>', // Sender's name and email
            to: payload.email,
            subject: "Your OTP Code",
            text: `Your OTP code is ${otp}. It will expire in 1 minute.`,
        });
        // Send success response after OTP is sent
        return res.send({ message: "OTP sent successfully.", otpId }); // Use return here to stop execution
    }
    catch (error) {
        console.error(error);
        return res.status(500).send({ message: "Failed to send OTP. Please try again." });
    }
});
AuthController.login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(req.body, "dfemkk");
    const payload = req.body;
    try {
        const { email } = payload;
        let checkEmailExists = yield auth_1.default.findOne({
            email: email,
        });
        console.log(checkEmailExists, "felmk");
        if ((0, lodash_1.isEmpty)(checkEmailExists)) {
            return res.send({ message: 'User does not exists' });
        }
        else {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            // Save OTP to in-memory storage (or use a database like Redis)
            const otpId = (0, uuid_1.v4)(); // Generate a unique id for this OTP
            OTPStorage[email] = {
                email: payload.email,
                otp,
                expiresAt: Date.now() + OTP_EXPIRATION_TIME, // Expiry time
            };
            // Nodemailer setup
            const transporter = nodemailer_1.default.createTransport({
                service: "gmail", // Use the service you prefer
                auth: {
                    user: "omify24@gmail.com", // Replace with your email
                    pass: "wwzx qwrr gjme jpqa", // Replace with your email password
                },
            });
            // Send the OTP email
            yield transporter.sendMail({
                from: '"Omify" <omify24@gmail.com>', // Sender's name and email
                to: payload.email,
                subject: "Your OTP Code",
                text: `Your OTP code is ${otp}. It will expire in 1 minute.`,
            });
            return res.send({ message: "OTP sent successfully.", otpId }); // Send the otpId to the client for verification
        }
    }
    catch (err) {
        return res.send({ message: err });
    }
});
AuthController.getAllUserDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let getAllData = yield auth_1.default.find({});
        return res.send(getAllData);
    }
    catch (err) {
        return res.send({ message: err });
    }
});
AuthController.getUserDataById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let payload = req.query;
    let { phoneNumber } = payload;
    const newPhoneNumber = `+91${phoneNumber.slice(-10)}`;
    try {
        // Correct the query with the trimmed and formatted phoneNumber
        let userDetail = yield auth_1.default.findOne({
            phoneNumber: newPhoneNumber
        });
        console.log(userDetail, "userDetail");
        return res.send(userDetail);
    }
    catch (err) {
        console.error(err);
        return res.send({ message: err });
    }
});
AuthController.updateUSerStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let payload = req.body;
    let { phoneNumber } = payload;
    try {
        const newPhoneNumber = `+91${phoneNumber.slice(-10)}`;
        console.log(newPhoneNumber, "dmk");
        let userDetail = yield auth_1.default.findOne({
            phoneNumber: newPhoneNumber,
        });
        if ((0, lodash_1.isEmpty)(userDetail)) {
            res.send({ message: 'User not Found' });
        }
        let updatedData = yield auth_1.default.findOneAndUpdate({
            phoneNumber: newPhoneNumber,
            $set: { status: 'ACTIVE' }
        });
        return res.send(updatedData);
    }
    catch (err) {
        return res.send({ message: err });
    }
});
exports.default = AuthController;
//# sourceMappingURL=authController.js.map