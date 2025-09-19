"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const TelegramNewUserSchema = new mongoose_1.Schema({
    userId: {
        type: Number
    },
    phoneNumber: {
        type: String,
        required: true
    },
    firstName: {
        type: String
    },
    lastName: {
        type: String,
        default: ''
    },
    username: {
        type: String,
        default: ''
    },
    registeredAt: {
        type: Date,
        default: Date.now
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});
const TelegramNewUser = (0, mongoose_1.model)('TelegramNewUser', TelegramNewUserSchema);
exports.default = TelegramNewUser;
//# sourceMappingURL=telegramNewUser.js.map