"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const config_1 = require("./config");
const agents_1 = __importDefault(require("./routes/agents"));
const positions_1 = __importDefault(require("./routes/positions"));
const users_1 = __importDefault(require("./routes/users"));
const gmx_auth_1 = __importDefault(require("./routes/gmx-auth"));
const gmx_1 = __importDefault(require("./routes/gmx"));
const GMXService_1 = require("./services/gmx/GMXService");
const winston_1 = __importDefault(require("winston"));
dotenv_1.default.config();
const app = (0, express_1.default)();
// Logger setup
const logger = winston_1.default.createLogger({
    level: "info",
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    transports: [
        new winston_1.default.transports.Console(),
        new winston_1.default.transports.File({ filename: "error.log", level: "error" }),
        new winston_1.default.transports.File({ filename: "combined.log" }),
    ],
});
// Initialize GMX Service in read-only mode on startup
(async () => {
    try {
        const gmxService = GMXService_1.GMXService.getInstance();
        await gmxService.initializeReadOnly();
        logger.info('GMXService initialized successfully on startup.');
    }
    catch (error) {
        logger.error('Failed to initialize GMXService on startup:', error);
        process.exit(1); // Exit if critical service fails to initialize
    }
})();
// Middleware
app.use((0, cors_1.default)({
    origin: ['http://localhost:3001', 'http://localhost:3000'], // Allow your frontend origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express_1.default.json());
// Health check
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// Serve static files for wallet connection UI
app.use(express_1.default.static('src/public'));
// Routes
app.use("/api/users", users_1.default);
app.use("/api/agents", agents_1.default);
app.use("/api/positions", positions_1.default);
app.use("/api/gmx-auth", gmx_auth_1.default);
app.use("/api/gmx", gmx_1.default);
// Error handling
app.use((err, req, res, next) => {
    logger.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
});
// Start server
const PORT = config_1.config.port;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${config_1.config.nodeEnv}`);
    logger.info(`Hyperliquid testnet: ${config_1.config.hyperliquid.testnet}`);
});
exports.default = app;
//# sourceMappingURL=app.js.map