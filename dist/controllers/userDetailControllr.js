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
const user_1 = __importDefault(require("../models/user"));
class UserPageController {
}
_a = UserPageController;
UserPageController.getAllPaymentUserDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let payload = req.query;
    let { phoneNumber } = payload;
    const newPhoneNumber = `+91${phoneNumber.slice(-10)}`;
    console.log(newPhoneNumber, "demlm");
    try {
        let getUserPaymentList = yield user_1.default.aggregate([
            {
                $match: { sellerPhoneNumber: newPhoneNumber } // Correctly filter documents
            },
            {
                $lookup: {
                    from: 'paymentpages',
                    let: { paymentPageId: { $toObjectId: "$paymentPageId" } }, // Convert to ObjectId
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$_id", "$$paymentPageId"] // Match ObjectId
                                }
                            }
                        }
                    ],
                    as: 'paymentDetails'
                },
            },
            { $unwind: { path: '$paymentDetails' } },
        ]);
        return res.send(getUserPaymentList);
    }
    catch (err) {
        return res.send({ message: err });
    }
});
exports.default = UserPageController;
//# sourceMappingURL=userDetailControllr.js.map