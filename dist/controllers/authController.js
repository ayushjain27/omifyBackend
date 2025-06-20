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
const staticIds_1 = __importDefault(require("../models/staticIds"));
const token_signer_1 = require("../utils/token-signer");
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
                return res
                    .status(500)
                    .send({ message: "Failed to resend OTP. Please try again." });
            }
        });
    }
    static verifyOtp(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(req.body, "dm4kemk");
            if (!req.body.otpId) {
                return res.send({ message: "OTP is required." });
            }
            try {
                // Check if OTP exists and is valid
                console.log(OTPStorage, "demkdmk");
                const storedOTP = OTPStorage[req.body.email];
                console.log(storedOTP, "melmfekm");
                console.log(typeof storedOTP.otp, "storedOTP.otp", typeof req.body.otpId);
                if (!storedOTP || Number(storedOTP.otp) !== Number(req.body.otpId)) {
                    return res.send({ message: "Invalid OTP." });
                }
                let data = yield auth_1.default.findOne({ email: req.body.email });
                if (!data) {
                    const lastCreatedUserId = yield staticIds_1.default.find({}).limit(1).exec();
                    const newUserId = String(parseInt(lastCreatedUserId[0].userId) + 1);
                    yield staticIds_1.default.findOneAndUpdate({}, { userId: newUserId });
                    // req.body.userName = `ADMIN`;
                    // req.body.role = "ADMIN";
                    req.body.userName = `USER${newUserId}`;
                    req.body.role = "USER";
                    req.body.status = "INACTIVE";
                    delete OTPStorage[req.body.email];
                    let newUser = yield auth_1.default.create(req.body);
                    console.group(newUser, "Delmk");
                    if (newUser) {
                        const payload = {
                            userId: newUser === null || newUser === void 0 ? void 0 : newUser.userName,
                            role: newUser === null || newUser === void 0 ? void 0 : newUser.role,
                        };
                        const token = yield (0, token_signer_1.generateToken)(payload);
                        console.log(token, "Demk");
                        const result = { user: newUser, token: token };
                        res.send({ result: result });
                    }
                }
                else {
                    const payload = {
                        userId: data.userName,
                        role: data.role,
                    };
                    const token = yield (0, token_signer_1.generateToken)(payload);
                    const result = { user: data, token: token };
                    res.send({ result: result });
                }
                console.log("dmkfef");
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
        return res
            .status(500)
            .send({ message: "Failed to send OTP. Please try again." });
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
        if (checkEmailExists) {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            console.log(otp, "DELMRDL");
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
        else {
            if (payload === null || payload === void 0 ? void 0 : payload.userId) {
                let checkUserIdExists = yield auth_1.default.findOne({
                    userName: payload === null || payload === void 0 ? void 0 : payload.userId,
                });
                if (!checkUserIdExists) {
                    return res.send({ message: "Getting Invalid UserName." });
                }
            }
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            console.log(otp, "DELMRDL");
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
        return res.send({ result: getAllData });
    }
    catch (err) {
        return res.send({ message: err });
    }
});
AuthController.getUserDataById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let payload = req.query;
    let { phoneNumber } = payload;
    const newPhoneNumber = `+91${phoneNumber === null || phoneNumber === void 0 ? void 0 : phoneNumber.slice(-10)}`;
    try {
        // Correct the query with the trimmed and formatted phoneNumber
        let userDetail = yield auth_1.default.findOne({
            phoneNumber: newPhoneNumber,
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
        const newPhoneNumber = `+91${phoneNumber === null || phoneNumber === void 0 ? void 0 : phoneNumber.slice(-10)}`;
        console.log(newPhoneNumber, "dmk");
        let userDetail = yield auth_1.default.findOne({
            phoneNumber: newPhoneNumber,
        });
        if ((0, lodash_1.isEmpty)(userDetail)) {
            res.send({ message: "User not Found" });
        }
        let updatedData = yield auth_1.default.findOneAndUpdate({
            phoneNumber: newPhoneNumber,
            $set: { status: "ACTIVE" },
        });
        return res.send(updatedData);
    }
    catch (err) {
        return res.send({ message: err });
    }
});
AuthController.updateStaticId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let payload = req.body;
    try {
        let result = staticIds_1.default.create(payload);
        return res.send(result);
    }
    catch (err) {
        return res.send({ message: err });
    }
});
AuthController.getUserDataByUserName = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c;
    let userName = (_b = req === null || req === void 0 ? void 0 : req.user) === null || _b === void 0 ? void 0 : _b.userId;
    let role = (_c = req === null || req === void 0 ? void 0 : req.user) === null || _c === void 0 ? void 0 : _c.role;
    try {
        let result = yield auth_1.default.findOne({ userName, role });
        return res.send({ result: result });
    }
    catch (err) {
        return res.send({ message: err });
    }
});
AuthController.updateUserProfileByUserName = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    let payload = req === null || req === void 0 ? void 0 : req.body;
    const checkUserExists = auth_1.default.findOne({
        userName: payload === null || payload === void 0 ? void 0 : payload.userName,
    });
    if (!checkUserExists) {
        res.send({ message: "No User Exists" });
    }
    const data = {
        name: payload === null || payload === void 0 ? void 0 : payload.name,
        phoneNumber: `+91${(_b = payload === null || payload === void 0 ? void 0 : payload.phoneNumber) === null || _b === void 0 ? void 0 : _b.slice(-10)}`,
        socialLinkSelected: payload === null || payload === void 0 ? void 0 : payload.socialLinkSelected,
        socialLink: payload === null || payload === void 0 ? void 0 : payload.socialLink,
    };
    try {
        let result = yield auth_1.default.findOneAndUpdate({ userName: payload === null || payload === void 0 ? void 0 : payload.userName }, { $set: data }, { new: true });
        return res.send({ result: result });
    }
    catch (err) {
        return res.send({ message: err });
    }
});
AuthController.updateKycByUserName = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let payload = req === null || req === void 0 ? void 0 : req.body;
    console.log(payload, "payload");
    const checkUserExists = auth_1.default.findOne({
        userName: payload === null || payload === void 0 ? void 0 : payload.userName,
    });
    if (!checkUserExists) {
        res.send({ message: "No User Exists" });
    }
    const data = {
        adhaarCardNumber: payload === null || payload === void 0 ? void 0 : payload.adhaarCardNumber,
        panCardNumber: payload === null || payload === void 0 ? void 0 : payload.panCardNumber,
        accountHolderName: payload === null || payload === void 0 ? void 0 : payload.accountHolderName,
        ifscCode: payload === null || payload === void 0 ? void 0 : payload.ifscCode,
        accountNumber: payload === null || payload === void 0 ? void 0 : payload.accountNumber,
    };
    try {
        let result = yield auth_1.default.findOneAndUpdate({ userName: payload === null || payload === void 0 ? void 0 : payload.userName }, { $set: data }, { new: true });
        return res.send({ result: result });
    }
    catch (err) {
        return res.send({ message: err });
    }
});
AuthController.uploadPanCardImage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            return res.status(400).send("No file uploaded.");
        }
        const filePath = `/tmp/uploadPanCardDir/${req.file.filename}`;
        console.log(req.body.userName, "frmnk");
        const authDetails = yield auth_1.default.findOneAndUpdate({ userName: req.body.userName }, // Query object
        { $set: { panCardImage: filePath } }, // Update object
        { new: true } // Return the updated document
        );
        console.log(authDetails, "uploadPanCardImage");
        return res
            .status(200)
            .json({ message: "File uploaded successfully", filePath });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
AuthController.uploadCancelCheckImage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            return res.status(400).send("No file uploaded.");
        }
        const filePath = `/tmp/uploadCancelCheckDir/${req.file.filename}`;
        console.log(req.body.userName, "frmnk");
        const authDetails = yield auth_1.default.findOneAndUpdate({ userName: req.body.userName }, // Query object
        { $set: { cancelCheckImage: filePath } }, // Update object
        { new: true } // Return the updated document
        );
        console.log(authDetails, "cancelCheckImage");
        return res
            .status(200)
            .json({ message: "File uploaded successfully", filePath });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.default = AuthController;
//# sourceMappingURL=authController.js.map