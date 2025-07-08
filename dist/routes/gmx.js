"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const GMXService_1 = require("../services/gmx/GMXService");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const config_1 = require("../config");
const jwt = __importStar(require("jsonwebtoken"));
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
// POST /api/gmx/auth/nonce
// Returns a nonce for wallet authentication
router.post('/auth/nonce', async (req, res) => {
    const { walletAddress } = req.body;
    if (!walletAddress) {
        return res.status(400).json({ error: 'Missing wallet address' });
    }
    // Generate a random nonce (could be more robust in production)
    const nonce = Math.floor(Math.random() * 1e16).toString();
    // Optionally: Save nonce to DB/session for later verification
    // For demo: store in-memory (replace with DB in production)
    global.gmx_nonces = global.gmx_nonces || {};
    global.gmx_nonces[walletAddress.toLowerCase()] = nonce;
    res.json({ nonce });
});
// POST /api/gmx/auth/verify
// Verifies the wallet signature and issues a JWT
router.post('/auth/verify', async (req, res) => {
    const { walletAddress, signature, nonce } = req.body;
    if (!walletAddress || !signature) {
        return res.status(400).json({ error: 'Wallet address and signature are required' });
    }
    const nonces = global.gmx_nonces || {};
    const issueToken = (address) => {
        const payload = { walletAddress: address };
        const secret = config_1.config.jwt.secret || 'magnolia-dev-secret';
        const options = { expiresIn: 60 * 60 * 24 * 7 }; // 7 days in seconds
        const token = jwt.sign(payload, secret, options);
        delete nonces[address.toLowerCase()]; // Clean up nonce after use
        res.json({ token });
    };
    // Bypass full verification for test signature
    if (signature === '0x1234') {
        logger_1.logger.info(`Using test signature for development for address: ${walletAddress}`);
        return issueToken(walletAddress);
    }
    // For real signatures, nonce is required
    if (!nonce) {
        return res.status(400).json({ error: 'Nonce is required for signature verification' });
    }
    const storedNonce = nonces[walletAddress.toLowerCase()];
    if (storedNonce !== nonce) {
        return res.status(400).json({ error: 'Invalid or expired nonce. Please try again.' });
    }
    const message = `Sign this message to authenticate: ${nonce}`;
    try {
        const { verifyMessage } = await Promise.resolve().then(() => __importStar(require('viem')));
        const isValid = await verifyMessage({
            address: walletAddress,
            message,
            signature: signature,
        });
        if (!isValid) {
            logger_1.logger.warn(`Signature verification failed for address: ${walletAddress}`);
            return res.status(401).json({ error: 'Invalid signature' });
        }
        logger_1.logger.info(`Signature verified for address: ${walletAddress}`);
        return issueToken(walletAddress);
    }
    catch (err) {
        logger_1.logger.error('An error occurred during signature verification:', err.message);
        return res.status(500).json({ error: 'Internal server error during verification' });
    }
});
// Initialize GMX service
const gmxService = GMXService_1.GMXService.getInstance();
/**
 * Get all available markets
 */
// Helper function to serialize BigInt values in objects
const serializeBigInt = (obj) => {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (typeof obj === 'bigint') {
        return obj.toString();
    }
    if (Array.isArray(obj)) {
        return obj.map(item => serializeBigInt(item));
    }
    if (typeof obj === 'object') {
        const result = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                result[key] = serializeBigInt(obj[key]);
            }
        }
        return result;
    }
    return obj;
};
router.get('/markets', async (req, res) => {
    try {
        // For market data, we don't need wallet authentication
        // Create a temporary instance for public data
        const tempService = GMXService_1.GMXService.getInstance();
        const markets = await tempService.getMarkets();
        // Serialize BigInt values before sending as JSON
        const serializedMarkets = serializeBigInt(markets);
        res.json({ markets: serializedMarkets });
    }
    catch (error) {
        logger_1.logger.error('Error fetching GMX markets:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch markets' });
    }
});
/**
 * Get market info by address
 */
router.get('/markets/:marketAddress', async (req, res) => {
    try {
        const { marketAddress } = req.params;
        // For market data, we don't need wallet authentication
        const tempService = GMXService_1.GMXService.getInstance();
        const marketInfo = await tempService.getMarketInfo(marketAddress);
        // Serialize BigInt values before sending as JSON
        const serializedMarketInfo = serializeBigInt(marketInfo);
        res.json(serializedMarketInfo);
    }
    catch (error) {
        logger_1.logger.error('Error fetching GMX market info:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch market info' });
    }
});
/**
 * Get positions for authenticated user
 * Requires JWT authentication with wallet address
 */
router.get('/positions', auth_1.authenticateJWT, async (req, res) => {
    try {
        // @ts-ignore - added by auth middleware
        const { address } = req.user;
        if (!address) {
            return res.status(400).json({ error: 'Wallet address not found in token' });
        }
        // For positions, we don't need to initialize with wallet
        // We just need the address to query positions
        const tempService = GMXService_1.GMXService.getInstance();
        const positions = await tempService.getPositions(address);
        // Serialize BigInt values before sending as JSON
        const serializedPositions = serializeBigInt(positions);
        res.json({ positions: serializedPositions });
    }
    catch (error) {
        logger_1.logger.error('Error fetching GMX positions:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch positions' });
    }
});
/**
 * Initialize GMX service with wallet
 * This endpoint is called after wallet connection
 */
router.post('/initialize', auth_1.authenticateJWT, async (req, res) => {
    try {
        // @ts-ignore - added by auth middleware
        const { address } = req.user;
        const { provider } = req.body;
        if (!address) {
            return res.status(400).json({ error: 'Wallet address not found in token' });
        }
        if (!provider) {
            return res.status(400).json({ error: 'Provider is required' });
        }
        await gmxService.initialize(address, provider);
        res.json({ success: true, message: 'GMX service initialized successfully' });
    }
    catch (error) {
        logger_1.logger.error('Error initializing GMX service:', error);
        res.status(500).json({ error: error.message || 'Failed to initialize GMX service' });
    }
});
/**
 * Create a long position
 */
router.post('/positions/long', auth_1.authenticateJWT, async (req, res) => {
    try {
        // @ts-ignore - added by auth middleware
        const { address } = req.user;
        if (!address) {
            return res.status(400).json({ error: 'Wallet address not found in token' });
        }
        // Initialize GMXService with wallet address for trading operations
        const walletService = GMXService_1.GMXService.createWalletInstance();
        await walletService.initializeForTransactions(address);
        // Extract parameters from request body
        const { marketAddress, collateralTokenAddress, indexTokenAddress, sizeDelta, initialCollateralDelta, triggerPrice, acceptablePrice, executionFee, callbackGasLimit, 
        // New GMX SDK parameters
        payAmount, payTokenAddress, leverage, allowedSlippageBps, 
        // Legacy parameters (for backward compatibility)
        collateralToken, indexToken, amount } = req.body;
        // Map legacy parameters to new parameters if provided
        const finalPayAmount = payAmount || amount;
        const finalPayTokenAddress = payTokenAddress || collateralTokenAddress || collateralToken;
        const finalCollateralTokenAddress = collateralTokenAddress || collateralToken;
        const finalIndexTokenAddress = indexTokenAddress || indexToken;
        const finalLeverage = leverage || 2; // Default leverage
        const finalAllowedSlippageBps = allowedSlippageBps || 50; // Default 0.5% slippage
        logger_1.logger.info('Opening long position with parameters:', {
            walletAddress: address,
            marketAddress,
            payAmount: finalPayAmount,
            payTokenAddress: finalPayTokenAddress,
            collateralTokenAddress: finalCollateralTokenAddress,
            indexTokenAddress: finalIndexTokenAddress,
            leverage: finalLeverage,
            allowedSlippageBps: finalAllowedSlippageBps,
            sizeDelta,
            initialCollateralDelta,
            triggerPrice,
            acceptablePrice,
            executionFee,
            callbackGasLimit
        });
        const result = await walletService.createLongPosition({
            marketAddress,
            payAmount: finalPayAmount,
            payTokenAddress: finalPayTokenAddress,
            collateralTokenAddress: finalCollateralTokenAddress,
            indexTokenAddress: finalIndexTokenAddress,
            leverage: finalLeverage,
            allowedSlippageBps: finalAllowedSlippageBps,
            sizeDelta,
            initialCollateralDelta,
            triggerPrice,
            acceptablePrice,
            executionFee,
            callbackGasLimit
        });
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error('Error creating long position:', error);
        res.status(500).json({ error: error.message || 'Failed to create long position' });
    }
});
/**
 * Create a short position
 */
router.post('/positions/short', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { marketAddress, payTokenAddress, collateralTokenAddress, payAmount, leverage, allowedSlippageBps, sizeDeltaUsd, acceptablePrice, triggerPrice, 
        // Legacy parameters for backward compatibility
        initialCollateralAddress, initialCollateralAmount, } = req.body;
        // Handle both new and legacy parameter structures
        const finalPayTokenAddress = payTokenAddress || initialCollateralAddress;
        const finalCollateralTokenAddress = collateralTokenAddress || initialCollateralAddress;
        const finalPayAmount = payAmount || initialCollateralAmount;
        const finalLeverage = leverage || '2000'; // Default 2x leverage
        const finalAllowedSlippageBps = allowedSlippageBps || 125; // Default 1.25% slippage
        // Validate required parameters
        if (!marketAddress || !finalPayTokenAddress || !finalPayAmount || !sizeDeltaUsd || !acceptablePrice) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }
        const txnHash = await gmxService.createShortPosition({
            marketAddress,
            payTokenAddress: finalPayTokenAddress,
            collateralTokenAddress: finalCollateralTokenAddress,
            payAmount: finalPayAmount,
            leverage: finalLeverage,
            allowedSlippageBps: finalAllowedSlippageBps,
            sizeDeltaUsd,
            acceptablePrice,
            triggerPrice,
            isLong: false,
            // Keep legacy parameters for compatibility
            initialCollateralAddress,
            initialCollateralAmount,
        });
        res.json({ success: true, txnHash });
    }
    catch (error) {
        logger_1.logger.error('Error creating short position:', error);
        res.status(500).json({ error: error.message || 'Failed to create short position' });
    }
});
/**
 * Close a position
 */
router.post('/positions/close', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { marketAddress, isLong, sizeDeltaUsd, acceptablePrice } = req.body;
        // Validate required parameters
        if (!marketAddress || isLong === undefined || !sizeDeltaUsd || !acceptablePrice) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }
        const txnHash = await gmxService.closePosition(marketAddress, isLong, sizeDeltaUsd, acceptablePrice);
        res.json({ success: true, txnHash });
    }
    catch (error) {
        logger_1.logger.error('Error closing position:', error);
        res.status(500).json({ error: error.message || 'Failed to close position' });
    }
});
/**
 * Swap tokens
 */
router.post('/swap', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { fromToken, toToken, amount } = req.body;
        // Validate required parameters
        if (!fromToken || !toToken || !amount) {
            return res.status(400).json({ error: 'Missing required parameters: fromToken, toToken, amount' });
        }
        const txnHash = await gmxService.swapTokens({
            fromTokenAddress: fromToken,
            toTokenAddress: toToken,
            fromAmount: amount
        });
        res.json({ success: true, txnHash });
    }
    catch (error) {
        logger_1.logger.error('Error swapping tokens:', error);
        res.status(500).json({ error: error.message || 'Failed to swap tokens' });
    }
});
/**
 * Cancel an order
 */
router.post('/orders/cancel', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { orderKey } = req.body;
        if (!orderKey) {
            return res.status(400).json({ error: 'Order key is required' });
        }
        const txnHash = await gmxService.cancelOrder(orderKey);
        res.json({ success: true, txnHash });
    }
    catch (error) {
        logger_1.logger.error('Error cancelling order:', error);
        res.status(500).json({ error: error.message || 'Failed to cancel order' });
    }
});
exports.default = router;
//# sourceMappingURL=gmx.js.map