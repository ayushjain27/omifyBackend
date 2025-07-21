"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymentPageController_1 = __importDefault(require("../controllers/paymentPageController"));
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ dest: 'uploads/' });
// Routes
router.post("/create", paymentPageController_1.default.createPaymentPage);
router.put("/create/:paymentPageId", paymentPageController_1.default.updatePaymentPage);
router.delete("/:paymentPageId", paymentPageController_1.default.deletePaymentPage);
router.get("/getPaymentDetailsListByPhoneNumber", paymentPageController_1.default.paymentDetailsListByPhoneNumber);
router.get("/getAllPaymentPages", paymentPageController_1.default.getAllPaymentPages);
router.post("/updatePaymentStatus", paymentPageController_1.default.updatePaymentStatus);
router.post("/createUserPaymentDetails", paymentPageController_1.default.createUserPaymentDetails);
router.post("/create-qr", paymentPageController_1.default.createQrCode);
// Image Upload Route
router.post("/upload", upload.single("image"), (err, req, res, next) => {
    if (err)
        return res.status(400).json({ error: err.message });
    next();
}, paymentPageController_1.default.imageUpload);
// File Upload Route (Any File)
router.post("/uploadAnything", upload.single("image"), (err, req, res, next) => {
    if (err)
        return res.status(400).json({ error: err.message });
    next();
}, paymentPageController_1.default.uploadAnything);
// router.get("/getImage/:filename", PaymentPageController.getImages);
router.get("/getPaymentPageDetailById", paymentPageController_1.default.getPaymentPageDetailById);
router.get('/countAllPaymentPagesByUserName', paymentPageController_1.default.countAllPaymentPagesByUserName);
router.post('/getAllPaymentPagesPaginated', paymentPageController_1.default.getAllPaymentPagesPaginated);
router.get('/countAllUsersDataByUserName', paymentPageController_1.default.countAllUsersDataByUserName);
router.get('/getAllUsersDataByUserName', paymentPageController_1.default.getAllUsersDataByUserName);
exports.default = router;
//# sourceMappingURL=paymentPage.js.map