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
    console.log(newPhoneNumber, "demlm");
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
        const filePath = `/tmp/uploads/${req.file.filename}`;
        console.log(req.body.paymentPageId, "frmnk");
        const paymentPage = yield paymentPage_1.default.findOneAndUpdate({ _id: req.body.paymentPageId }, // Query object
        { $set: { imageUrl: filePath } }, // Update object
        { new: true } // Return the updated document
        );
        console.log(paymentPage, "dlefl");
        return res
            .status(200)
            .json({ message: "File uploaded successfully", filePath });
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
        const filePath = `/tmp/userUploadData/${req.file.filename}`;
        console.log(req.body.paymentPageId, "frmnk");
        const paymentPage = yield paymentPage_1.default.findOneAndUpdate({ _id: req.body.paymentPageId }, // Query object
        { $set: { file: filePath } }, // Update object
        { new: true } // Return the updated document
        );
        console.log(paymentPage, "dlefl");
        return res
            .status(200)
            .json({ message: "File uploaded successfully", filePath });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
PaymentPageController.getImages = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { filename } = req.params; // Extract filename from the request params
        const filePath = path_1.default.join("/tmp", "uploads", req.params.filename);
        console.log(filePath, "dlem");
        if (fs_1.default.existsSync(filePath)) {
            return res.sendFile(filePath);
        }
        else {
            return res.status(404).send("File not found");
        }
        // Serve the file
        // return res.sendFile(filePath);
        // return res
        //   .status(200)
        //   .json({ message: "File uploaded successfully", filePath });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
PaymentPageController.getPaymentPageDetailById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const paymentPageId = req.query.id;
    console.log(req.query, "drmfk");
    let query = {
        _id: paymentPageId,
    };
    let paymentDetails = yield paymentPage_1.default.findOne(query);
    return res.send(paymentDetails);
});
PaymentPageController.countAllPaymentPagesByUserName = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d, _e, _f, _g;
    const userName = req.query.userName;
    const query = {
        userName,
    };
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
        userName: payload.userName,
        status: payload.status,
    };
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
    console.log(paymentPageId, "paymentPageId");
    try {
        let paymentPage = yield paymentPage_1.default.findOne({
            _id: paymentPageId,
        });
        console.log(paymentPage, "fmrknfknrk");
        if ((0, lodash_1.isEmpty)(paymentPage)) {
            res.send({ message: "Payment Page not Found" });
        }
        console.log("mfkrmkkk");
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
        console.log(err, "dmekmfk");
        return res.send({ message: err });
    }
});
exports.default = PaymentPageController;
//# sourceMappingURL=paymentPageController.js.map