"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || "development",
    database: {
        url: process.env.DATABASE_URL,
    },
    redis: {
        url: process.env.REDIS_URL || "redis://localhost:6379",
    },
    hyperliquid: {
        testnet: process.env.HYPERLIQUID_TESTNET === "true",
    },
    gmx: {
        rpcUrl: process.env.GMX_RPC_URL || "https://avalanche-fuji-c-chain.publicnode.com",
        oracleUrl: process.env.GMX_ORACLE_URL || "https://avalanche-api.gmxinfra.io",
        subsquidUrl: process.env.GMX_SUBSQUID_URL || "https://gmx-fuji.squids.live/gmx-synthetics-fuji/graphql",
        chainId: parseInt(process.env.GMX_CHAIN_ID || "43113"), // Avalanche Fuji
    },
    jwt: {
        secret: process.env.JWT_SECRET || "magnolia-dev-secret",
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
    monitoring: {
        intervalMinutes: parseInt(process.env.MONITOR_INTERVAL_MINUTES || "30"),
    },
};
//# sourceMappingURL=index.js.map