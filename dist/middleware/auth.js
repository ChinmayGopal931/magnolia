"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateJWT = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
/**
 * Middleware to authenticate JWT tokens
 */
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Authorization header is required' });
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Bearer token is required' });
    }
    try {
        const jwtSecret = config_1.config.jwt.secret || 'magnolia-dev-secret';
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        // @ts-ignore - add user data to request
        req.user = decoded;
        next();
    }
    catch (error) {
        logger_1.logger.error('JWT verification failed:', error);
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};
exports.authenticateJWT = authenticateJWT;
//# sourceMappingURL=auth.js.map