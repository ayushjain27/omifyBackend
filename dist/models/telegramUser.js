"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const telegramUserSchema = new mongoose_1.Schema({
    phoneNumber: {
        type: String,
        required: true,
        unique: true
    },
    verified: {
        type: Boolean,
        default: false
    },
    userName: {
        type: String
    },
    verifiedAt: {
        type: Date
    }
}, {
    timestamps: true,
    strict: false // Allows saving extra fields even if not defined in the schema
});
const TelegramUser = (0, mongoose_1.model)('TelegramUser', telegramUserSchema);
exports.default = TelegramUser;
//# sourceMappingURL=telegramUser.js.map