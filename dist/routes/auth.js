"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = __importDefault(require("../controllers/authController"));
const authenticate_1 = require("../authenticate");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
const ensureDirExists = (dir) => {
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
};
const uploadPanCardDir = path_1.default.join("/tmp", "uploadPanCardDir");
const uploadCancelCheckDir = path_1.default.join("/tmp", "uploadCancelCheckDir");
const uploadPanCardImage = (0, multer_1.default)({
    dest: uploadPanCardDir,
    fileFilter: (_req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
        cb(null, allowedTypes.includes(file.mimetype));
    },
});
const uploadCancelCheckImage = (0, multer_1.default)({
    dest: uploadCancelCheckDir,
    limits: { fileSize: 10 * 1024 * 1024 },
});
ensureDirExists(uploadPanCardDir);
ensureDirExists(uploadCancelCheckDir);
router.post("/signUp", authController_1.default.signUp);
router.post("/verifyOtp", authController_1.default.verifyOtp);
router.post("/login", authController_1.default.login);
router.post("/resendOtp", authController_1.default.resendOtp);
router.get('/countAllUsers', authController_1.default.countAllUsers);
router.get('/getAllUserDetails', authController_1.default.getAllUserDetails);
// router.get("/getAllUserDetails", AuthController.getAllUserDetails);
router.get("/getUserDataByUserId", authController_1.default.getUserDataById);
router.post("/updateUserStatus", authController_1.default.updateUSerStatus);
router.post("/updateStaticId", authController_1.default.updateStaticId);
router.get("/getUserDataByUserName", authenticate_1.authenticateJWT, authController_1.default.getUserDataByUserName);
router.post("/updateUserProfileByUserName", authController_1.default.updateUserProfileByUserName);
router.post("/updateKycByUserName", authController_1.default.updateKycByUserName);
router.get("/getPanCardImage/:filename", authController_1.default.getPanCardImage);
router.get("/getCancelCheckImage/:filename", authController_1.default.getCancelCheckImage);
router.post("/uploadPanCardImage", uploadPanCardImage.single("file"), (err, req, res, next) => {
    if (err)
        return res.status(400).json({ error: err.message });
    next();
}, authController_1.default.uploadPanCardImage);
router.post("/uploadCancelCheckImage", uploadCancelCheckImage.single("file"), (err, req, res, next) => {
    if (err)
        return res.status(400).json({ error: err.message });
    next();
}, authController_1.default.uploadCancelCheckImage);
exports.default = router;
//# sourceMappingURL=auth.js.map