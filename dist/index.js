"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const database_1 = __importDefault(require("./config/database"));
const auth_1 = __importDefault(require("./routes/auth"));
const paymentPage_1 = __importDefault(require("./routes/paymentPage"));
const userDetail_1 = __importDefault(require("./routes/userDetail"));
const app = (0, express_1.default)();
const port = 12000;
(0, database_1.default)();
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/auth', auth_1.default);
app.use('/paymentPage', paymentPage_1.default);
app.use('/userPaymentDetails', userDetail_1.default);
app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});
//# sourceMappingURL=index.js.map