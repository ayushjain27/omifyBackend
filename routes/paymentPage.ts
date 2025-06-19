import { Router } from "express";
import PaymentPageController from "../controllers/paymentPageController";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

// Function to ensure a directory exists
const ensureDirExists = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Directories
const uploadDir = path.join('/tmp', 'uploads');
const uploadAnythingDir = path.join('/tmp', 'userUploadData');

// Ensure directories exist
ensureDirExists(uploadDir);
ensureDirExists(uploadAnythingDir);

// Function to configure multer storage
const configureStorage = (destination: string) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, destination),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  });

// File filter for images
const imageFileFilter = (_req: any, file: any, cb: any) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
  allowedTypes.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error("Invalid file type. Only JPEG, PNG, and JPG are allowed."));
};

// Multer instances
const upload = multer({ 
  dest: uploadDir,
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});

const uploadAnything = multer({ 
  dest: uploadAnythingDir,
  limits: { fileSize: 10 * 1024 * 1024 } 
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
router.post("/uploadAnything", uploadAnything.single("file"), (err: any, req: any, res: any, next: any) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
}, PaymentPageController.uploadAnything);

router.get("/getImage/:filename", PaymentPageController.getImages);
router.get("/getPaymentPageDetailById", PaymentPageController.getPaymentPageDetailById);
router.get(
  '/countAllPaymentPagesByUserName',
  PaymentPageController.countAllPaymentPagesByUserName
);
router.post(
  '/getAllPaymentPagesPaginated',
  PaymentPageController.getAllPaymentPagesPaginated
);

export default router;
