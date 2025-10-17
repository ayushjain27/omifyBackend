import express from "express";
import cors from "cors";
import connectToMongo from "./config/database";
import auth from "./routes/auth";
import paymentPage from "./routes/paymentPage";
import userPaymentDetailsPage from "./routes/userDetail";
import telegram from "./routes/telegram";
import cron from "node-cron";
import axios from "axios";
import TelegramPage from "./models/telegramPage";
import TelegramNewUser from "./models/telegramNewUser";

const app = express();
const port = 15000;

connectToMongo();

app.get("/", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/auth", auth);
app.use("/paymentPage", paymentPage);
app.use("/userPaymentDetails", userPaymentDetailsPage);
app.use("/telegram", telegram);

cron.schedule("* * * * *", () => {
  console.log("⏳ Running hourly orderNo reshuffle...");
  getChannelMembersViaChannelId();
});

const getChannelMembersViaChannelId = async () => {
  try {
    console.log(
      `Running getChannelMembersViaUserApi at: ${new Date().toISOString()}`
    );

    // Get all active Telegram pages
    const telegramPages = await TelegramPage.find({ status: "ACTIVE" });
    console.log(telegramPages,"AFlew;kmlf")

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

        const response = await axios.post(
          `http://localhost:15000/telegram/getChannelMembersViaUserApi`,
          requestData,
          {
            headers: {
              "Content-Type": "application/json",
            },
            timeout: 59000, // 59 seconds
          }
        );
        // Optional: Save the result to database
        await saveMembersToDatabase(item.channelId, response.data);
      } catch (error) {
        console.error(
          `❌ Error processing channel ${item.channelId}:`,
          error.message
        );

        // Continue with next channel even if one fails
        continue;
      }
    }
  } catch (error) {
    console.error("Cron job error:", error.message);
  }
};

// Optional: Function to save members data to database
const saveMembersToDatabase = async (channelId: any, responseData: any) => {
  try {
    // Yahan aap response data ko database mein save kar sakte hain
    if (responseData.members) {
      // Example: Update TelegramPage with member count
      for (const item of responseData.members) {
        console.log(item,"qs;ldkmewk", channelId)
        await TelegramNewUser.findOneAndUpdate(
          { channelId: channelId, phoneNumber: `+91${item.phone.slice(-10)}` },
          {
            firstName: item.firstName,
            lastName: item.lastName,
            userId: item.userId,
          }
        );
      }
    }
  } catch (dbError) {
    console.error(
      `Error saving members for channel ${channelId}:`,
      dbError.message
    );
  }
};

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
