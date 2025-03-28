"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = __importDefault(require("../controllers/authController"));
const router = (0, express_1.Router)();
router.post('/signUp', authController_1.default.signUp);
router.post('/verifyOtp', authController_1.default.verifyOtp);
router.post('/login', authController_1.default.login);
router.post('/resendOtp', authController_1.default.resendOtp);
router.get('/getAllUserDetails', authController_1.default.getAllUserDetails);
router.get('/getUserDataById', authController_1.default.getUserDataById);
router.post('/updateUserStatus', authController_1.default.updateUSerStatus);
exports.default = router;
//# sourceMappingURL=auth.js.map