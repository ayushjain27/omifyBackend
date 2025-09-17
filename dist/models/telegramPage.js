"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const plansSchema = new mongoose_1.Schema({
    price: {
        type: Number,
    },
    discount: {
        type: Number,
    },
    totalNumber: {
        type: Number,
    },
    value: {
        type: String,
    },
}, {
    timestamps: true,
    strict: true
});
const telegramPageSchema = new mongoose_1.Schema({
    channelName: {
        type: String,
    },
    channelLink: {
        type: String,
    },
    userName: {
        type: String,
    },
    title: {
        type: String,
    },
    description: {
        type: String,
    },
    status: {
        type: String,
        default: 'INACTIVE'
    },
    phoneNumber: {
        type: String,
    },
    buttonText: {
        type: String,
    },
    category: {
        type: String,
    },
    imageUrl: {
        type: String,
    },
    plans: {
        type: [plansSchema],
    }
}, {
    timestamps: true,
    strict: true
});
const TelegramPage = (0, mongoose_1.model)('telegramPage', telegramPageSchema);
exports.default = TelegramPage;
//# sourceMappingURL=telegramPage.js.map