"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
const telegram_1 = __importDefault(require("./routes/telegram"));
const node_cron_1 = __importDefault(require("node-cron"));
const axios_1 = __importDefault(require("axios"));
const telegramPage_1 = __importDefault(require("./models/telegramPage"));
const telegramNewUser_1 = __importDefault(require("./models/telegramNewUser"));
const app = (0, express_1.default)();
const port = 15000;
(0, database_1.default)();
app.get("/", (req, res) => {
    res.status(200).json({
        status: "OK",
        message: "Server is running",
        timestamp: new Date().toISOString(),
    });
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use("/auth", auth_1.default);
app.use("/paymentPage", paymentPage_1.default);
app.use("/userPaymentDetails", userDetail_1.default);
app.use("/telegram", telegram_1.default);
node_cron_1.default.schedule("* * * * *", () => {
    console.log("⏳ Running hourly orderNo reshuffle...");
    getChannelMembersViaChannelId();
});
const getChannelMembersViaChannelId = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`Running getChannelMembersViaUserApi at: ${new Date().toISOString()}`);
        // Get all active Telegram pages
        const telegramPages = yield telegramPage_1.default.find({ status: "ACTIVE" });
        console.log(telegramPages, "AFlew;kmlf");
        // Check if there are any active pages
        if (!telegramPages || telegramPages.length === 0) {
            console.log("No active Telegram pages found");
            return;
        }
        console.log(`Processing ${telegramPages.length} active channels`);
        // Process each channel sequentially
        for (const item of telegramPages) {
            try {
                // Validate required fields
                if (!item.channelId || !item.phoneNumber) {
                    console.warn(`Skipping channel - missing channelId or phoneNumber:`, {
                        channelId: item.channelId,
                        phoneNumber: item.phoneNumber,
                    });
                    continue;
                }
                const requestData = {
                    channelId: item.channelId,
                    phoneNumber: item.phoneNumber,
                };
                console.log(`Fetching members for channel: ${item.channelId}`);
                const response = yield axios_1.default.post(`http://localhost:15000/telegram/getChannelMembersViaUserApi`, requestData, {
                    headers: {
                        "Content-Type": "application/json",
                    },
                    timeout: 59000, // 59 seconds
                });
                // Optional: Save the result to database
                yield saveMembersToDatabase(item.channelId, response.data);
            }
            catch (error) {
                console.error(`❌ Error processing channel ${item.channelId}:`, error.message);
                // Continue with next channel even if one fails
                continue;
            }
        }
    }
    catch (error) {
        console.error("Cron job error:", error.message);
    }
});
// Optional: Function to save members data to database
const saveMembersToDatabase = (channelId, responseData) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Yahan aap response data ko database mein save kar sakte hain
        if (responseData.members) {
            // Example: Update TelegramPage with member count
            for (const item of responseData.members) {
                console.log(item, "qs;ldkmewk", channelId);
                yield telegramNewUser_1.default.findOneAndUpdate({ channelId: channelId, phoneNumber: `+91${item.phone.slice(-10)}` }, {
                    firstName: item.firstName,
                    lastName: item.lastName,
                    userId: item.userId,
                });
            }
        }
    }
    catch (dbError) {
        console.error(`Error saving members for channel ${channelId}:`, dbError.message);
    }
});
app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});
//# sourceMappingURL=index.js.map