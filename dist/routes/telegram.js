"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const telegramController_1 = __importDefault(require("../controllers/telegramController"));
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(), // This should prevent any disk writes
    limits: {
        fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
    },
});
router.post("/send-otp", telegramController_1.default.sendOtp);
router.post("/verify-otp", telegramController_1.default.verifyLoginOtp);
router.post("/create-channel", telegramController_1.default.createChannel);
// router.post("/fetch-channel", TelegramController.fetchUserChannels);
// router.post('/verify-2fa', TelegramController.verify2FAPassword);
// router.post("/verifyOtp", AuthController.verifyOtp);
// router.post("/login", AuthController.login);
// router.post("/resendOtp", AuthController.resendOtp);
// router.get(
//   '/countAllUsers',
//   AuthController.countAllUsers
// );
// router.get(
//   '/getAllUserDetails',
//   AuthController.getAllUserDetails
// );
// // router.get("/getAllUserDetails", AuthController.getAllUserDetails);
// router.get("/getUserDataByUserId", AuthController.getUserDataById);
// router.post("/updateUserStatus", AuthController.updateUserStatus);
// router.post("/updateStaticId", AuthController.updateStaticId);
// router.get(
//   "/getUserDataByUserName",
//   authenticateJWT,
//   AuthController.getUserDataByUserName
// );
// router.post(
//   "/updateUserProfileByUserName",
//   AuthController.updateUserProfileByUserName
// );
// router.post(
//   "/updateKycByUserName",
//   AuthController.updateKycByUserName
// );
// router.post("/uploadPanCardImage",  upload.single('image'), (err: any, req: any, res: any, next: any) => {
//     if (err) return res.status(400).json({ error: err.message });
//     next();
//   }, AuthController.uploadPanCardImage);
//   router.post("/uploadCancelCheckImage",  upload.single('image'), (err: any, req: any, res: any, next: any) => {
//     if (err) return res.status(400).json({ error: err.message });
//     next();
//   }, AuthController.uploadCancelCheckImage);
exports.default = router;
//# sourceMappingURL=telegram.js.map