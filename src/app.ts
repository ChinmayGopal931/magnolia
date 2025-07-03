import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { config } from "./config";
import agentRoutes from "./routes/agents";
import positionRoutes from "./routes/positions";
import userRoutes from "./routes/users";
import winston from "winston";

dotenv.config();

const app = express();

// Logger setup
const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: "error.log", level: "error" }),
        new winston.transports.File({ filename: "combined.log" }),
    ],
});

// Middleware
app.use(cors({
    origin: ['http://localhost:3001', 'http://localhost:3000'], // Allow your frontend origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/users", userRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/positions", positionRoutes);

// Error handling
app.use(
    (
        err: any,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
    ) => {
        logger.error("Unhandled error:", err);
        res.status(500).json({ error: "Internal server error" });
    },
);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Hyperliquid testnet: ${config.hyperliquid.testnet}`);
});

export default app;
