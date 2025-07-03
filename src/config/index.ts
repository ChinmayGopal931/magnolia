import dotenv from "dotenv";

dotenv.config();

export const config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || "development",
    database: {
        url: process.env.DATABASE_URL!,
    },
    redis: {
        url: process.env.REDIS_URL || "redis://localhost:6379",
    },
    hyperliquid: {
        testnet: process.env.HYPERLIQUID_TESTNET === "true",
    },
    monitoring: {
        intervalMinutes: parseInt(process.env.MONITOR_INTERVAL_MINUTES || "30"),
    },
};
