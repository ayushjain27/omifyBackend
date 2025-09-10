"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const telegramGroupSchema = new mongoose_1.Schema({
    groupId: {
        type: String,
        required: true,
        unique: true
    },
    title: {
        type: String,
        required: true
    },
    memberCount: {
        type: Number,
        default: 0
    },
    adminPhone: {
        type: String,
        required: true
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true,
    strict: false // Allows saving extra fields even if not defined in the schema
});
const TelegramGroup = (0, mongoose_1.model)('TelegramGroup', telegramGroupSchema);
exports.default = TelegramGroup;
//# sourceMappingURL=telegramGroup.js.map