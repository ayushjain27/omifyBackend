"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const userSchema = new mongoose_1.Schema({
    name: {
        type: String
    },
    phoneNumber: {
        type: String,
        required: true
    },
    email: {
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
    }
}, { timestamps: true });
userSchema.index({ phoneNumber: 1, role: 1 }, { unique: true });
const User = (0, mongoose_1.model)('users', userSchema);
exports.default = User;
//# sourceMappingURL=auth.js.map