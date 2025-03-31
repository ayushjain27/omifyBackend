"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymentPageController_1 = __importDefault(require("../controllers/paymentPageController"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
// Function to ensure a directory exists
const ensureDirExists = (dir) => {
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
};
// Directories
const uploadDir = path_1.default.join('/tmp', 'uploads');
const uploadAnythingDir = path_1.default.join('/tmp', 'userUploadData');
// Ensure directories exist
ensureDirExists(uploadDir);
ensureDirExists(uploadAnythingDir);
// Function to configure multer storage
const configureStorage = (destination) => multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, destination),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
// File filter for images
const imageFileFilter = (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    allowedTypes.includes(file.mimetype)
        ? cb(null, true)
        : cb(new Error("Invalid file type. Only JPEG, PNG, and JPG are allowed."));
};
// Multer instances
const upload = (0, multer_1.default)({
    dest: uploadDir,
    fileFilter: (_req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
        cb(null, allowedTypes.includes(file.mimetype));
    }
});
const uploadAnything = (0, multer_1.default)({
    dest: uploadAnythingDir,
    limits: { fileSize: 10 * 1024 * 1024 }
});
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
router.post("/uploadAnything", uploadAnything.single("file"), (err, req, res, next) => {
    if (err)
        return res.status(400).json({ error: err.message });
    next();
}, paymentPageController_1.default.uploadAnything);
router.get("/getImage/:filename", paymentPageController_1.default.getImages);
router.get("/getPaymentPageDetailById", paymentPageController_1.default.getPaymentPageDetailById);
exports.default = router;
//# sourceMappingURL=paymentPage.js.map