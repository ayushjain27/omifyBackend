"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateJWT = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Add this middleware before your routes
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1]; // Bearer <token>
        jsonwebtoken_1.default.verify(token, 'OMIFY_SECRET', (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user; // Attach decoded payload to request
            next();
        });
    }
    else {
        res.sendStatus(401);
    }
};
exports.authenticateJWT = authenticateJWT;
//# sourceMappingURL=authenticate.js.map