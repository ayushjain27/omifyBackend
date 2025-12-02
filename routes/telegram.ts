import { Router } from "express";
import TelegramController from "../controllers/telegramController";
import { authenticateJWT } from "../authenticate";
import multer from "multer";
import axios from "axios";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(), // This should prevent any disk writes
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
  },
});

const validateToken = async (req: any, res: any, next: any) => {
  const { apiToken } = req.body;
  
  if (!apiToken) {
    return res.status(400).json({ error: 'API token is required' });
  }
  
  try {
    // Verify the token is valid by calling getMe
    const response = await axios.get(`https://api.telegram.org/bot${apiToken}/getMe`);
    req.botInfo = response.data.result;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid API token' });
  }
};

router.post("/send-otp", TelegramController.sendOtp);

router.post("/verify-otp", TelegramController.verifyLoginOtp);

router.post("/create-channel", TelegramController.createChannel);

router.post("/create-telegram-page", TelegramController.createTelegramPage);

router.put('/telegram-pages/:id', TelegramController.updateTelegramPage);

router.post("/upload", upload.single("image"), (err: any, req: any, res: any, next: any) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
}, TelegramController.imageUpload);

router.get(
  '/countAllTelegramPagesByUserName',
  TelegramController.countAllTelegramPagesByUserName
);

router.post(
  '/getAllTelegramPagesPaginated',
  TelegramController.getAllTelegramPagesPaginated
);

router.get(
  '/getTelegramPageDetailsById',
  TelegramController.getTelegramPageDetailsById
);

router.post(
  '/getTelegramPageDetailsById',
  TelegramController.getTelegramPageDetailsById
);

router.post(
  '/addBotToChannel',
  TelegramController.addBotToChannel
);

router.post(
  '/validateToken',
  TelegramController.validateToken
);

router.get('/countAllTelegramUsersByChannelId', TelegramController.countAllTelegramUsersByChannelId)

router.post('/getAllTelegramUsersByChannelId', TelegramController.getAllTelegramUsersByChannelId)

router.post('/add-user-to-channel', TelegramController.AddUserToChannel)

router.post('/remove-user-to-channel', TelegramController.RemoveUserFromChannel)

// router.post('/getChannelMemberCount', TelegramController.getChannelMemberCount)

// router.post('/getChannelInfo', TelegramController.getChannelInfo)

// router.post('/getChannelAdministrators', TelegramController.getChannelAdministrators)

// router.post('/checkUserMembership', TelegramController.checkUserMembership)

// router.post('/getChannelMembersLimited', TelegramController.getChannelMembersLimited)

// router.post('/getAllChannelMembers', TelegramController.getAllChannelMembers)

// router.post('/getChannelMemberDetails', TelegramController.getChannelMemberDetails)

// router.post('/getChannelMembersPaginated', TelegramController.getChannelMembersPaginated)

// router.post('/getChannelMembers', TelegramController.getChannelMembers)

router.post('/getChannelMembersViaUserApi', TelegramController.getChannelMembersViaUserApi)

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

export default router;
