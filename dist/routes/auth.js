"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = __importDefault(require("../controllers/authController"));
const authenticate_1 = require("../authenticate");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(), // This should prevent any disk writes
    limits: {
        fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
    },
});
router.post("/signUp", authController_1.default.signUp);
router.post("/verifyOtp", authController_1.default.verifyOtp);
router.post("/login", authController_1.default.login);
router.post("/resendOtp", authController_1.default.resendOtp);
router.get('/countAllUsers', authController_1.default.countAllUsers);
router.get('/getAllUserDetails', authController_1.default.getAllUserDetails);
// router.get("/getAllUserDetails", AuthController.getAllUserDetails);
router.get("/getUserDataByUserId", authController_1.default.getUserDataById);
router.post("/updateUserStatus", authController_1.default.updateUserStatus);
router.post("/updateStaticId", authController_1.default.updateStaticId);
router.get("/getUserDataByUserName", authenticate_1.authenticateJWT, authController_1.default.getUserDataByUserName);
router.post("/updateUserProfileByUserName", authController_1.default.updateUserProfileByUserName);
router.post("/updateKycByUserName", authController_1.default.updateKycByUserName);
router.post("/uploadPanCardImage", upload.single('image'), (err, req, res, next) => {
    if (err)
        return res.status(400).json({ error: err.message });
    next();
}, authController_1.default.uploadPanCardImage);
router.post("/uploadCancelCheckImage", upload.single('image'), (err, req, res, next) => {
    if (err)
        return res.status(400).json({ error: err.message });
    next();
}, authController_1.default.uploadCancelCheckImage);
exports.default = router;
//# sourceMappingURL=auth.js.map