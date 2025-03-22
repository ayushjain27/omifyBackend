"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userDetailControllr_1 = __importDefault(require("../controllers/userDetailControllr"));
const router = (0, express_1.Router)();
router.get('/getAllPaymentUserDetails', userDetailControllr_1.default.getAllPaymentUserDetails);
exports.default = router;
//# sourceMappingURL=userDetail.js.map