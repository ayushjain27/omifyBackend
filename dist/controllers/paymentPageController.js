"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const paymentPage_1 = __importDefault(require("../models/paymentPage"));
const lodash_1 = require("lodash");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_1 = __importDefault(require("../models/auth"));
const user_1 = __importDefault(require("../models/user"));
const cloudinary_1 = require("cloudinary");
// Initialize Cloudinary configuration
cloudinary_1.v2.config({
    cloud_name: "dmvudmx86",
    api_key: "737943533352822",
    api_secret: "LILUHv0IFf790mbLoXndhKki34E", // Use environment variable
});
class PaymentPageController {
}
_a = PaymentPageController;
PaymentPageController.createPaymentPage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = req.body;
    try {
        const response = yield paymentPage_1.default.create(payload);
        return res.send(response);
    }
    catch (err) {
        return res.send({ message: err });
    }
});
PaymentPageController.updatePaymentPage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const paymentPageId = req.params.paymentPageId;
    const payload = req.body;
    let paymentPageData;
    if (paymentPageId) {
        paymentPageData = yield paymentPage_1.default.findOne({
            _id: paymentPageId,
        });
    }
    if ((0, lodash_1.isEmpty)(paymentPageData)) {
        throw new Error("Page Not Found");
    }
    try {
        const response = yield paymentPage_1.default.findOneAndUpdate(Object.assign({ _id: paymentPageId }, payload));
        return res.send(response);
    }
    catch (err) {
        return res.send({ message: err });
    }
});
PaymentPageController.deletePaymentPage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const paymentPageId = req.params.paymentPageId;
    const payload = req.body;
    let paymentPageData;
    if (paymentPageId) {
        paymentPageData = yield paymentPage_1.default.findOne({
            _id: paymentPageId,
        });
    }
    if ((0, lodash_1.isEmpty)(paymentPageData)) {
        throw new Error("Page Not Found");
    }
    try {
        const response = yield paymentPage_1.default.findOneAndDelete({
            _id: paymentPageId,
        });
        return res.send(response);
    }
    catch (err) {
        return res.send({ message: err });
    }
});
PaymentPageController.paymentDetailsListByPhoneNumber = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let payload = req.query;
    let { phoneNumber } = payload;
    const newPhoneNumber = `+91${phoneNumber.slice(-10)}`;
    try {
        let getUserPaymentDetailsList = yield paymentPage_1.default.find({
            phoneNumber: newPhoneNumber,
        });
        return res.send(getUserPaymentDetailsList);
    }
    catch (err) {
        return res.send({ message: err });
    }
});
PaymentPageController.getAllPaymentPages = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const allPaymentPages = yield paymentPage_1.default.find({});
    res.send(allPaymentPages);
});
PaymentPageController.updatePaymentStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let payload = req.body;
    let { paymentId } = payload;
    try {
        let paymentPage = yield paymentPage_1.default.findOne({
            _id: paymentId,
        });
        if ((0, lodash_1.isEmpty)(paymentPage)) {
            res.send({ message: "Payment Page not Found" });
        }
        let updatedData = yield paymentPage_1.default.findOneAndUpdate({ _id: paymentId }, // Query condition
        { $set: { status: "ACTIVE" } }, // Update fields
        { new: true } // Return updated document
        );
        return res.send(updatedData);
    }
    catch (err) {
        return res.send({ message: err });
    }
});
PaymentPageController.createUserPaymentDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let payload = req.body;
    let { paymentPageId } = payload;
    try {
        let paymentPage = yield paymentPage_1.default.findOne({
            _id: paymentPageId,
        }).lean();
        if ((0, lodash_1.isEmpty)(paymentPage)) {
            res.send({ message: "Payment Page not Found" });
        }
        let reqBody = Object.assign({}, payload);
        reqBody.sellerPhoneNumber = `+91${paymentPage === null || paymentPage === void 0 ? void 0 : paymentPage.phoneNumber.slice(-10)}`;
        let userDetails = yield auth_1.default.findOne({
            phoneNumber: `+91${reqBody.sellerPhoneNumber.slice(-10)}`,
        });
        if ((0, lodash_1.isEmpty)(userDetails)) {
            return res.send({ message: "User not Found" });
        }
        reqBody.sellerName = userDetails === null || userDetails === void 0 ? void 0 : userDetails.name;
        let userDetailsPayment = user_1.default.create(reqBody);
        return res.send(userDetailsPayment);
    }
    catch (err) {
        return res.send({ message: err });
    }
});
PaymentPageController.imageUpload = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            return res.status(400).send("No file uploaded.");
        }
        // Validate it's an image
        const allowedTypes = ['.jpg', '.jpeg', '.png', '.webp'];
        const fileExt = path_1.default.extname(req.file.originalname).toLowerCase();
        if (!allowedTypes.includes(fileExt)) {
            fs_1.default.unlinkSync(req.file.path); // Clean up temp file
            return res.status(400).json({ error: "Only image files are allowed" });
        }
        // Optimized Cloudinary upload settings
        const uploadResult = yield cloudinary_1.v2.uploader.upload(req.file.path, {
            public_id: `img_${Date.now()}`,
            quality: 'auto:best', // Best quality with smart compression
            fetch_format: 'auto', // Auto-convert to modern formats (like WebP)
            width: 1500, // Max width
            height: 1500, // Max height
            crop: 'limit', // Don't crop, just resize if larger
            format: 'jpg', // Convert all to JPG (smaller than PNG)
            transformation: [{
                    quality: '80', // 80% quality (optimal for file size vs quality)
                    dpr: 'auto' // Device pixel ratio aware
                }]
        });
        // Clean up temp file
        fs_1.default.unlinkSync(req.file.path);
        const paymentPage = yield paymentPage_1.default.findOneAndUpdate({ _id: req.body.paymentPageId }, // Query object
        { $set: { imageUrl: uploadResult === null || uploadResult === void 0 ? void 0 : uploadResult.secure_url } }, // Update object
        { new: true } // Return the updated document
        );
        return res
            .status(200)
            .json({ message: "File uploaded successfully" });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
PaymentPageController.uploadAnything = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            return res.status(400).send("No file uploaded.");
        }
        const filePath = req.file.path;
        const fileExtension = path_1.default.extname(req.file.originalname).toLowerCase();
        const options = {
            resource_type: 'auto', // Automatically detect the file type
            public_id: `doc_${Date.now()}`,
            quality: 'auto:good', // Optimize quality automatically
            fetch_format: 'auto', // Automatically choose best format
        };
        // Special handling for different file types
        if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(fileExtension)) {
            options.quality_analysis = true; // Analyze and optimize image quality
            options.transformation = [
                { width: 1000, height: 1000, crop: 'limit' } // Resize large images while maintaining aspect ratio
            ];
        }
        else if (['.pdf'].includes(fileExtension)) {
            options.resource_type = 'raw'; // Treat PDF as raw file
            options.format = 'pdf';
        }
        else if (['.xls', '.xlsx', '.csv'].includes(fileExtension)) {
            options.resource_type = 'raw'; // Treat Excel files as raw
        }
        else if (['.mp4', '.mov', '.avi'].includes(fileExtension)) {
            options.resource_type = 'video';
            options.quality = 'auto:good';
            options.bit_rate = '500k'; // Reduce video size while maintaining decent quality
        }
        // Upload to Cloudinary
        const uploadResult = yield cloudinary_1.v2.uploader.upload(filePath, options);
        // Clean up the temporary file
        fs_1.default.unlinkSync(filePath);
        const paymentPage = yield paymentPage_1.default.findOneAndUpdate({ _id: req.body.paymentPageId }, // Query object
        { $set: { file: uploadResult === null || uploadResult === void 0 ? void 0 : uploadResult.secure_url } }, // Update object
        { new: true } // Return the updated document
        );
        return res
            .status(200)
            .json({ message: "File uploaded successfully" });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
PaymentPageController.getImages = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const filePath = path_1.default.join("/tmp", "uploads", req.params.filename);
        if (fs_1.default.existsSync(filePath)) {
            return res.sendFile(filePath);
        }
        else {
            return res.status(404).send("File not found");
        }
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
PaymentPageController.getPaymentPageDetailById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const paymentPageId = req.query.id;
    let query = {
        _id: paymentPageId,
    };
    let paymentDetails = yield paymentPage_1.default.findOne(query);
    return res.send(paymentDetails);
});
PaymentPageController.countAllPaymentPagesByUserName = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d, _e, _f, _g;
    const userName = req.query.userName;
    const query = {};
    if (userName !== "ADMIN") {
        query.userName = userName;
    }
    const counts = yield paymentPage_1.default.aggregate([
        {
            $match: query,
        },
        {
            $facet: {
                total: [{ $count: "count" }],
                active: [{ $match: { status: "ACTIVE" } }, { $count: "count" }],
                inactive: [{ $match: { status: "INACTIVE" } }, { $count: "count" }],
            },
        },
    ]);
    // Extract the counts from the aggregation result
    const result = {
        total: ((_c = (_b = counts[0]) === null || _b === void 0 ? void 0 : _b.total[0]) === null || _c === void 0 ? void 0 : _c.count) || 0,
        active: ((_e = (_d = counts[0]) === null || _d === void 0 ? void 0 : _d.active[0]) === null || _e === void 0 ? void 0 : _e.count) || 0,
        inActive: ((_g = (_f = counts[0]) === null || _f === void 0 ? void 0 : _f.inactive[0]) === null || _g === void 0 ? void 0 : _g.count) || 0,
    };
    return res.send(result);
});
PaymentPageController.getAllPaymentPagesPaginated = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = req.body;
    const query = {
        status: payload.status,
    };
    if (payload.userName !== "ADMIN") {
        query.userName = payload.userName;
    }
    const pageNo = payload === null || payload === void 0 ? void 0 : payload.pageNo;
    const pageSize = payload === null || payload === void 0 ? void 0 : payload.pageSize;
    const result = yield paymentPage_1.default.find(query)
        .sort({ createdAt: -1 }) // Sort in descending order
        .skip(pageNo * pageSize)
        .limit(pageSize);
    return res.send(result);
});
PaymentPageController.createQrCode = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let payload = req.body;
    let { paymentPageId } = payload;
    try {
        let paymentPage = yield paymentPage_1.default.findOne({
            _id: paymentPageId,
        });
        if ((0, lodash_1.isEmpty)(paymentPage)) {
            res.send({ message: "Payment Page not Found" });
        }
        const fakeQrCodeData = {
            id: "qr_123456789",
            entity: "qr_code",
            name: "Test QR Code",
            usage: "single_use",
            status: "active",
            payment_amount: 50000, // 500 INR
            currency: "INR",
            image_url: "https://i.postimg.cc/vTk2c1SX/Scanner-Image.png",
        };
        // ✅ Send Fake QR Code Response
        return res.status(200).send(fakeQrCodeData);
        // let userDetailsPayment = UserDetailsPage.create(reqBody);
        // return res.send(qr);
    }
    catch (err) {
        return res.send({ message: err });
    }
});
exports.default = PaymentPageController;
//# sourceMappingURL=paymentPageController.js.map