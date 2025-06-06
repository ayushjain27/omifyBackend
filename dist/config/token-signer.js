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
exports.generateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = require("crypto");
const generateToken = (claims_1, ...args_1) => __awaiter(void 0, [claims_1, ...args_1], void 0, function* (claims, signingOptions = {
    expiresIn: "365d"
}) {
    return jsonwebtoken_1.default.sign(Object.assign(Object.assign({}, claims), { iss: (0, crypto_1.createHash)('sha256').update("OMIFY").digest('hex') }), "OMIFY_SECRET", signingOptions);
});
exports.generateToken = generateToken;
//# sourceMappingURL=token-signer.js.map