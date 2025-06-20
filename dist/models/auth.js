"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const userSchema = new mongoose_1.Schema({
    name: {
        type: String
    },
    phoneNumber: {
        type: String
    },
    role: {
        type: String
    },
    email: {
        type: String
    },
    userName: {
        type: String
    },
    userId: {
        type: String
    },
    status: {
        type: String
    },
    adhaarCardNumber: {
        type: String
    },
    panCardNumber: {
        type: String
    },
    accountHolderName: {
        type: String
    },
    ifscCode: {
        type: String
    },
    accountNumber: {
        type: String
    },
    socialLinkSelected: {
        type: String
    },
    socialLink: {
        type: String
    },
    panCardImage: {
        type: String
    },
    cancelCheckImage: {
        type: String
    }
}, { timestamps: true });
const User = (0, mongoose_1.model)('users', userSchema);
exports.default = User;
//# sourceMappingURL=auth.js.map