"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const staticIdsSchema = new mongoose_1.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    employeeId: {
        type: String,
        required: true,
        unique: true
    },
}, { timestamps: true });
const StaticIds = (0, mongoose_1.model)('staticId', staticIdsSchema);
exports.default = StaticIds;
//# sourceMappingURL=staticIds.js.map