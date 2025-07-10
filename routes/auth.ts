import { Router } from "express";
import AuthController from "../controllers/authController";
import { authenticateJWT } from "../authenticate";
import multer from "multer";

const router = Router();

const upload = multer({ dest: 'uploads/' });

router.post("/signUp", AuthController.signUp);

router.post("/verifyOtp", AuthController.verifyOtp);

router.post("/login", AuthController.login);

router.post("/resendOtp", AuthController.resendOtp);

router.get(
  '/countAllUsers',
  AuthController.countAllUsers
);
router.get(
  '/getAllUserDetails',
  AuthController.getAllUserDetails
);
// router.get("/getAllUserDetails", AuthController.getAllUserDetails);

router.get("/getUserDataByUserId", AuthController.getUserDataById);

router.post("/updateUserStatus", AuthController.updateUserStatus);

router.post("/updateStaticId", AuthController.updateStaticId);

router.get(
  "/getUserDataByUserName",
  authenticateJWT,
  AuthController.getUserDataByUserName
);

router.post(
  "/updateUserProfileByUserName",
  AuthController.updateUserProfileByUserName
);

router.post(
  "/updateKycByUserName",
  AuthController.updateKycByUserName
);

router.post("/uploadPanCardImage",  upload.single('image'), (err: any, req: any, res: any, next: any) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  }, AuthController.uploadPanCardImage);

  router.post("/uploadCancelCheckImage",  upload.single('image'), (err: any, req: any, res: any, next: any) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  }, AuthController.uploadCancelCheckImage);

export default router;
