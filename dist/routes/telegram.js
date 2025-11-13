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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const telegramController_1 = __importDefault(require("../controllers/telegramController"));
const multer_1 = __importDefault(require("multer"));
const axios_1 = __importDefault(require("axios"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(), // This should prevent any disk writes
    limits: {
        fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
    },
});
const validateToken = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { apiToken } = req.body;
    if (!apiToken) {
        return res.status(400).json({ error: 'API token is required' });
    }
    try {
        // Verify the token is valid by calling getMe
        const response = yield axios_1.default.get(`https://api.telegram.org/bot${apiToken}/getMe`);
        req.botInfo = response.data.result;
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Invalid API token' });
    }
});
router.post("/send-otp", telegramController_1.default.sendOtp);
router.post("/verify-otp", telegramController_1.default.verifyLoginOtp);
router.post("/create-channel", telegramController_1.default.createChannel);
router.post("/create-telegram-page", telegramController_1.default.createTelegramPage);
router.post("/upload", upload.single("image"), (err, req, res, next) => {
    if (err)
        return res.status(400).json({ error: err.message });
    next();
}, telegramController_1.default.imageUpload);
router.get('/countAllTelegramPagesByUserName', telegramController_1.default.countAllTelegramPagesByUserName);
router.post('/getAllTelegramPagesPaginated', telegramController_1.default.getAllTelegramPagesPaginated);
router.get('/getTelegramPageDetailsById', telegramController_1.default.getTelegramPageDetailsById);
router.post('/getTelegramPageDetailsById', telegramController_1.default.getTelegramPageDetailsById);
router.post('/addBotToChannel', telegramController_1.default.addBotToChannel);
router.post('/validateToken', telegramController_1.default.validateToken);
router.get('/countAllTelegramUsersByChannelId', telegramController_1.default.countAllTelegramUsersByChannelId);
router.post('/getAllTelegramUsersByChannelId', telegramController_1.default.getAllTelegramUsersByChannelId);
router.post('/add-user-to-channel', telegramController_1.default.AddUserToChannel);
router.post('/remove-user-to-channel', telegramController_1.default.RemoveUserFromChannel);
// router.post('/getChannelMemberCount', TelegramController.getChannelMemberCount)
// router.post('/getChannelInfo', TelegramController.getChannelInfo)
// router.post('/getChannelAdministrators', TelegramController.getChannelAdministrators)
// router.post('/checkUserMembership', TelegramController.checkUserMembership)
// router.post('/getChannelMembersLimited', TelegramController.getChannelMembersLimited)
// router.post('/getAllChannelMembers', TelegramController.getAllChannelMembers)
// router.post('/getChannelMemberDetails', TelegramController.getChannelMemberDetails)
// router.post('/getChannelMembersPaginated', TelegramController.getChannelMembersPaginated)
// router.post('/getChannelMembers', TelegramController.getChannelMembers)
router.post('/getChannelMembersViaUserApi', telegramController_1.default.getChannelMembersViaUserApi);
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