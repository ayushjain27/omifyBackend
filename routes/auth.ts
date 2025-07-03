import { Router } from "express";
import AuthController from "../controllers/authController";
import { authenticateJWT } from "../authenticate";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

const ensureDirExists = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const uploadPanCardDir = path.join("/tmp", "uploadPanCardDir");
const uploadCancelCheckDir = path.join("/tmp", "uploadCancelCheckDir");

const uploadPanCardImage = multer({
  dest: uploadPanCardDir,
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    cb(null, allowedTypes.includes(file.mimetype));
  },
});

const uploadCancelCheckImage = multer({
  dest: uploadCancelCheckDir,
  limits: { fileSize: 10 * 1024 * 1024 },
});

ensureDirExists(uploadPanCardDir);
ensureDirExists(uploadCancelCheckDir);

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

router.get("/getUserDataById", AuthController.getUserDataById);

router.post("/updateUserStatus", AuthController.updateUSerStatus);

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

router.post("/uploadPanCardImage", uploadPanCardImage.single("file"), (err: any, req: any, res: any, next: any) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  }, AuthController.uploadPanCardImage);

  router.post("/uploadCancelCheckImage", uploadCancelCheckImage.single("file"), (err: any, req: any, res: any, next: any) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  }, AuthController.uploadCancelCheckImage);

export default router;
