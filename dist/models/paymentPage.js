"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const paymentSchema = new mongoose_1.Schema({
    status: {
        type: String,
        default: 'INACTIVE'
    },
    phoneNumber: {
        type: String
    },
    userName: {
        type: String
    },
    price: {
        type: String
    },
    pageTitle: {
        type: String
    },
    category: {
        type: String
    },
    description: {
        type: String
    },
    buttonText: {
        type: String
    },
    imageUrl: {
        type: String
    },
    file: {
        type: String
    },
    link: {
        type: String
    }
}, {
    timestamps: true,
    strict: false // Allows saving extra fields even if not defined in the schema
});
const PaymentPage = (0, mongoose_1.model)('paymentPage', paymentSchema);
exports.default = PaymentPage;
//# sourceMappingURL=paymentPage.js.map