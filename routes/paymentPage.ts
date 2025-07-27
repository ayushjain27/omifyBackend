import { Router } from "express";
import PaymentPageController from "../controllers/paymentPageController";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(), // This should prevent any disk writes
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
  },
});
// Routes
router.post("/create", PaymentPageController.createPaymentPage);
router.put("/create/:paymentPageId", PaymentPageController.updatePaymentPage);
router.delete("/:paymentPageId", PaymentPageController.deletePaymentPage);
router.get("/getPaymentDetailsListByPhoneNumber", PaymentPageController.paymentDetailsListByPhoneNumber);
router.get("/getAllPaymentPages", PaymentPageController.getAllPaymentPages);
router.post("/updatePaymentStatus", PaymentPageController.updatePaymentStatus);
router.post("/createUserPaymentDetails", PaymentPageController.createUserPaymentDetails);
router.post("/create-qr", PaymentPageController.createQrCode);

// Image Upload Route
router.post("/upload", upload.single("image"), (err: any, req: any, res: any, next: any) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
}, PaymentPageController.imageUpload);

// File Upload Route (Any File)
router.post("/uploadAnything", upload.single("image"), (err: any, req: any, res: any, next: any) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
}, PaymentPageController.uploadAnything);

router.get("/getPaymentPageDetailById", PaymentPageController.getPaymentPageDetailById);
router.get(
  '/countAllPaymentPagesByUserName',
  PaymentPageController.countAllPaymentPagesByUserName
);
router.post(
  '/getAllPaymentPagesPaginated',
  PaymentPageController.getAllPaymentPagesPaginated
);

router.get(
  '/countAllUsersDataByUserName',
  PaymentPageController.countAllUsersDataByUserName
);
router.get(
  '/getAllUsersDataByUserName',
  PaymentPageController.getAllUsersDataByUserName
);

export default router;
