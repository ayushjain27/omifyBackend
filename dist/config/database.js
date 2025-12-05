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
const mongoose_1 = __importDefault(require("mongoose"));
const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const mongoURI = "mongodb+srv://Omify:Omify2025@cluster0.yzkok.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
        // Log for debugging
        console.log('Connecting to MongoDB...');
        // Connect using mongoose
        yield mongoose_1.default.connect(mongoURI, {
            // Serverless optimized options
            maxPoolSize: 10, // Limit connections
            serverSelectionTimeoutMS: 5000, // Timeout after 5s
            socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
        });
        console.log('✅ MongoDB Connected Successfully');
        // Handle connection events
        mongoose_1.default.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });
        mongoose_1.default.connection.on('disconnected', () => {
            console.log('⚠️ MongoDB disconnected');
        });
        mongoose_1.default.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconnected');
        });
        // Graceful shutdown for serverless
        process.on('SIGINT', () => __awaiter(void 0, void 0, void 0, function* () {
            yield mongoose_1.default.connection.close();
            console.log('MongoDB connection closed through app termination');
            process.exit(0);
        }));
    }
    catch (err) {
        console.error("❌ Error connecting to MongoDB:", err);
        // Don't exit process in serverless - just log error
        throw err;
    }
});
exports.default = connectDB;
//# sourceMappingURL=database.js.map