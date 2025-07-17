"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const userDetailsPageSchema = new mongoose_1.Schema({
    name: {
        type: String
    },
    email: {
        type: String
    },
    phoneNumber: {
        type: String
    },
    paymentPageId: {
        type: String
    },
    userName: {
        type: String
    },
    paymentAmount: {
        type: String
    }
}, {
    timestamps: true,
    strict: false,
});
const UserDetailsPage = (0, mongoose_1.model)("userDetailsPage", userDetailsPageSchema);
exports.default = UserDetailsPage;
//# sourceMappingURL=user.js.map