"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GMXService = void 0;
const sdk_1 = require("@gmx-io/sdk");
const viem_1 = require("viem");
const chains_1 = require("viem/chains");
const config_1 = require("../../config");
const winston_1 = __importDefault(require("winston"));
// Create a logger instance if not imported
const logger = winston_1.default.createLogger({
    level: "info",
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    transports: [
        new winston_1.default.transports.Console(),
        new winston_1.default.transports.File({ filename: "error.log", level: "error" }),
        new winston_1.default.transports.File({ filename: "combined.log" }),
    ],
});
/**
 * Service for interacting with GMX protocol
 */
class GMXService {
    static instance;
    sdk = null;
    publicClient;
    marketsInfo = null;
    tokensData = null;
    constructor() {
        // Initialize public client for read operations
        this.publicClient = (0, viem_1.createPublicClient)({
            chain: chains_1.avalancheFuji,
            transport: (0, viem_1.http)(config_1.config.gmx.rpcUrl)
        });
    }
    static getInstance() {
        if (!GMXService.instance) {
            GMXService.instance = new GMXService();
        }
        return GMXService.instance;
    }
    /**
     * Create a new wallet-connected GMXService instance for trading operations
     * This bypasses the singleton pattern to allow per-wallet instances
     */
    static createWalletInstance() {
        return new GMXService();
    }
    /**
     * Initialize the GMX SDK with a wallet client
     * @param walletAddress The user's wallet address
     * @param provider The wallet provider (e.g., from MetaMask)
     */
    async initializeReadOnly() {
        try {
            // For read-only operations, we can initialize the SDK without a signer
            // by creating a public client and passing it. The SDK may require a walletClient
            // interface, so we create one that is essentially read-only.
            this.sdk = new sdk_1.GmxSdk({
                chainId: config_1.config.gmx.chainId,
                rpcUrl: config_1.config.gmx.rpcUrl,
                oracleUrl: config_1.config.gmx.oracleUrl,
                subsquidUrl: config_1.config.gmx.subsquidUrl,
                walletClient: this.publicClient, // Use public client for read-only init
            });
            await this.loadMarketData();
            logger.info('GMX SDK initialized in read-only mode.');
        }
        catch (error) {
            logger.error('Failed to initialize GMX SDK in read-only mode:', error);
            throw new Error(`Failed to initialize GMX SDK in read-only mode: ${error}`);
        }
    }
    async initialize(walletAddress, provider) {
        try {
            // Create a wallet client using the provider
            const walletClient = (0, viem_1.createWalletClient)({
                account: walletAddress,
                chain: chains_1.avalancheFuji,
                transport: (0, viem_1.custom)(provider)
            });
            // Initialize the GMX SDK
            this.sdk = new sdk_1.GmxSdk({
                chainId: config_1.config.gmx.chainId,
                rpcUrl: config_1.config.gmx.rpcUrl,
                oracleUrl: config_1.config.gmx.oracleUrl,
                walletClient,
                subsquidUrl: config_1.config.gmx.subsquidUrl
            });
            // Load markets and tokens data
            await this.loadMarketData();
            logger.info(`GMX SDK initialized for wallet: ${walletAddress}`);
        }
        catch (error) {
            logger.error('Failed to initialize GMX SDK:', error);
            throw new Error(`Failed to initialize GMX SDK: ${error}`);
        }
    }
    /**
     * Initialize GMX SDK for transaction creation (without provider)
     * This creates a wallet client that can create transactions but not sign them
     */
    async initializeForTransactions(walletAddress) {
        try {
            // Create a temporary wallet client using public transport
            // This allows us to create transactions without needing browser provider
            const walletClient = (0, viem_1.createWalletClient)({
                account: walletAddress,
                chain: chains_1.avalancheFuji,
                transport: (0, viem_1.http)(config_1.config.gmx.rpcUrl)
            });
            // Initialize the GMX SDK
            this.sdk = new sdk_1.GmxSdk({
                chainId: config_1.config.gmx.chainId,
                rpcUrl: config_1.config.gmx.rpcUrl,
                oracleUrl: config_1.config.gmx.oracleUrl,
                walletClient,
                subsquidUrl: config_1.config.gmx.subsquidUrl
            });
            // Load markets and tokens data
            await this.loadMarketData();
            logger.info(`GMX SDK initialized for transactions with wallet: ${walletAddress}`);
        }
        catch (error) {
            logger.error('Failed to initialize GMX SDK for transactions:', error);
            throw new Error(`Failed to initialize GMX SDK for transactions: ${error}`);
        }
    }
    /**
     * Load market data required for most GMX operations
     */
    async loadMarketData() {
        if (!this.sdk) {
            throw new Error('GMX SDK not initialized');
        }
        try {
            const { marketsInfoData, tokensData } = await this.sdk.markets.getMarketsInfo();
            this.marketsInfo = marketsInfoData;
            this.tokensData = tokensData;
            logger.info('GMX market data loaded successfully', this.marketsInfo, this.tokensData);
        }
        catch (error) {
            logger.error('Failed to load GMX market data:', error);
            throw new Error(`Failed to load GMX market data: ${error}`);
        }
    }
    /**
     * Get all available markets
     * @returns List of market information
     */
    async getMarkets() {
        if (!this.marketsInfo) {
            await this.loadMarketData();
        }
        try {
            return Object.values(this.marketsInfo).map((market) => ({
                marketAddress: market.marketTokenAddress,
                indexToken: market.indexToken.symbol,
                longToken: market.longToken.symbol,
                shortToken: market.shortToken.symbol,
                marketTokenAddress: market.marketTokenAddress,
                name: market.name,
                data: market // Include full market data
            }));
        }
        catch (error) {
            logger.error('Failed to get GMX markets:', error);
            throw new Error(`Failed to get GMX markets: ${error}`);
        }
    }
    /**
     * Get all positions for a wallet address
     * @param walletAddress The wallet address to get positions for
     * @returns List of positions
     */
    async getPositions(walletAddress) {
        if (!this.sdk) {
            throw new Error('GMX SDK not initialized');
        }
        try {
            // @ts-ignore - The SDK types don't match the actual API
            const positionsResult = await this.sdk.positions.getPositions({
                marketsData: this.marketsInfo,
                tokensData: this.tokensData,
                // @ts-ignore - The SDK types don't match the actual API
                account: walletAddress
            });
            // Convert positions to our format
            const positionsList = Array.isArray(positionsResult) ? positionsResult : [];
            return positionsList.map((position) => ({
                id: position.key,
                account: position.account,
                marketAddress: position.marketAddress,
                collateralToken: position.collateralTokenAddress,
                indexToken: position.indexTokenAddress,
                isLong: position.isLong,
                sizeInUsd: position.sizeInUsd.toString(),
                sizeInTokens: position.sizeInTokens.toString(),
                collateralAmount: position.collateralAmount.toString(),
                entryPrice: position.entryPrice.toString(),
                markPrice: position.markPrice.toString(),
                liquidationPrice: position.liquidationPrice.toString(),
                leverage: position.leverage.toString(),
                pnl: position.pnl.toString(),
                pnlPercentage: position.pnlPercentage.toString(),
                status: position.isLiquidatable ? 'liquidatable' : 'open'
            }));
        }
        catch (error) {
            logger.error(`Failed to get positions for ${walletAddress}:`, error);
            throw new Error(`Failed to get positions: ${error}`);
        }
    }
    /**
     * Create a long position
     * @param params Order parameters
     * @returns Transaction hash
     */
    async createLongPosition(params) {
        if (!this.sdk || !this.marketsInfo || !this.tokensData) {
            throw new Error('GMX SDK or market data not initialized');
        }
        try {
            // Use new parameters that match GMX SDK requirements
            const orderParams = {
                payAmount: BigInt(params.payAmount),
                marketAddress: params.marketAddress,
                payTokenAddress: params.payTokenAddress,
                collateralTokenAddress: params.collateralTokenAddress,
                acceptablePrice: params.acceptablePrice ? BigInt(params.acceptablePrice) : BigInt('0'),
                leverage: BigInt(params.leverage),
                allowedSlippageBps: params.allowedSlippageBps,
                marketsInfoData: this.marketsInfo,
                tokensData: this.tokensData
            };
            logger.info('Creating long position with params:', {
                payAmount: orderParams.payAmount.toString(),
                marketAddress: orderParams.marketAddress,
                leverage: orderParams.leverage.toString(),
                allowedSlippageBps: orderParams.allowedSlippageBps
            });
            // @ts-ignore - The SDK types don't match the actual API
            const result = await this.sdk.orders.long(orderParams);
            // @ts-ignore - The SDK types don't match the actual API
            const txnHash = result?.txnHash || '';
            logger.info(`Created long position, txn: ${txnHash}`);
            return txnHash;
        }
        catch (error) {
            logger.error('Failed to create long position:', error);
            throw new Error(`Failed to create long position: ${error}`);
        }
    }
    /**
     * Create a short position
     * @param params Order parameters
     * @returns Transaction hash
     */
    async createShortPosition(params) {
        if (!this.sdk || !this.marketsInfo || !this.tokensData) {
            throw new Error('GMX SDK or market data not initialized');
        }
        try {
            // Use new parameters that match GMX SDK requirements
            const orderParams = {
                payAmount: BigInt(params.payAmount),
                marketAddress: params.marketAddress,
                payTokenAddress: params.payTokenAddress,
                collateralTokenAddress: params.collateralTokenAddress,
                acceptablePrice: BigInt(params.acceptablePrice || '0'),
                leverage: BigInt(params.leverage),
                allowedSlippageBps: params.allowedSlippageBps,
                marketsInfoData: this.marketsInfo,
                tokensData: this.tokensData
            };
            logger.info('Creating short position with params:', {
                payAmount: orderParams.payAmount.toString(),
                marketAddress: orderParams.marketAddress,
                leverage: orderParams.leverage.toString(),
                allowedSlippageBps: orderParams.allowedSlippageBps
            });
            // @ts-ignore - The SDK types don't match the actual API
            const result = await this.sdk.orders.short(orderParams);
            // @ts-ignore - The SDK types don't match the actual API
            const txnHash = result?.txnHash || '';
            logger.info(`Created short position, txn: ${txnHash}`);
            return txnHash;
        }
        catch (error) {
            logger.error('Failed to create short position:', error);
            throw new Error(`Failed to create short position: ${error}`);
        }
    }
    /**
     * Close a position
     * @param marketAddress The market address
     * @param isLong Whether the position is long or short
     * @param sizeDeltaUsd The size to close in USD
     * @param acceptablePrice The acceptable price for closing
     * @returns Transaction hash
     */
    async closePosition(marketAddress, isLong, sizeDeltaUsd, acceptablePrice) {
        if (!this.sdk || !this.marketsInfo || !this.tokensData) {
            throw new Error('GMX SDK or market data not initialized');
        }
        try {
            // Find market info
            const marketInfo = Object.values(this.marketsInfo).find((m) => m.marketTokenAddress.toLowerCase() === marketAddress.toLowerCase()); // Using any type since GMX SDK types are not fully defined
            if (!marketInfo) {
                throw new Error(`Market not found for address: ${marketAddress}`);
            }
            // Create a decrease order to close the position
            // @ts-ignore - The SDK types don't match the actual API
            const result = await this.sdk.orders.createDecreaseOrder({
                marketInfo,
                marketsInfoData: this.marketsInfo, // SDK expects marketsInfoData, not marketsData
                tokensData: this.tokensData,
                isLong,
                allowedSlippage: 0.5, // 0.5% slippage
                decreaseAmounts: {
                    sizeDeltaUsd: BigInt(sizeDeltaUsd),
                    acceptablePrice
                },
                collateralToken: isLong ? marketInfo.longToken : marketInfo.shortToken
            });
            // Handle result which might be void or have a different structure than expected
            let resultTxnHash = '';
            // @ts-ignore - The SDK types don't match the actual API
            if (result) {
                // @ts-ignore - The SDK types don't match the actual API
                resultTxnHash = result.txnHash || (typeof result === 'string' ? result : '');
            }
            logger.info(`Closed position, txn: ${resultTxnHash}`);
            return resultTxnHash;
        }
        catch (error) {
            logger.error('Failed to close position:', error);
            throw new Error(`Failed to close position: ${error}`);
        }
    }
    /**
     * Cancel an order
     * @param orderKey The key of the order to cancel
     * @returns Transaction hash
     */
    async cancelOrder(orderKey) {
        if (!this.sdk) {
            throw new Error('GMX SDK not initialized');
        }
        try {
            const result = await this.sdk.orders.cancelOrders([orderKey]);
            const txnHash = result.toString();
            logger.info(`Cancelled order ${orderKey}, txn: ${txnHash}`);
            return txnHash;
        }
        catch (error) {
            logger.error(`Failed to cancel order ${orderKey}:`, error);
            throw new Error(`Failed to cancel order: ${error}`);
        }
    }
    /**
     * Swap tokens
     * @param params Swap parameters
     * @returns Transaction hash
     */
    async swapTokens(params) {
        if (!this.sdk || !this.marketsInfo || !this.tokensData) {
            throw new Error('GMX SDK or market data not initialized');
        }
        try {
            const swapParams = {
                fromAmount: BigInt(params.fromAmount),
                fromTokenAddress: params.fromTokenAddress,
                toTokenAddress: params.toTokenAddress,
                allowedSlippageBps: 125, // 1.25% slippage
            };
            // @ts-ignore - The SDK types don't match the actual API
            const result = await this.sdk.orders.swap(swapParams);
            // @ts-ignore - The SDK types don't match the actual API
            const txnHash = result?.txnHash || '';
            logger.info(`Swapped tokens, txn: ${txnHash}`);
            return txnHash;
        }
        catch (error) {
            logger.error('Failed to swap tokens:', error);
            throw new Error(`Failed to swap tokens: ${error}`);
        }
    }
    /**
     * Get market info by market address
     * @param marketAddress The market address
     * @returns Market information
     */
    async getMarketInfo(marketAddress) {
        if (!this.marketsInfo) {
            await this.loadMarketData();
        }
        try {
            const market = Object.values(this.marketsInfo).find((m) => m.marketTokenAddress.toLowerCase() === marketAddress.toLowerCase());
            if (!market) {
                return null;
            }
            return {
                marketAddress: market.marketTokenAddress,
                indexToken: market.indexToken?.symbol || '',
                longToken: market.longToken?.symbol || '',
                shortToken: market.shortToken?.symbol || '',
                marketTokenAddress: market.marketTokenAddress,
                name: market.name || '',
                data: market
            };
        }
        catch (error) {
            logger.error(`Failed to get market info for ${marketAddress}:`, error);
            throw new Error(`Failed to get market info: ${error}`);
        }
    }
}
exports.GMXService = GMXService;
//# sourceMappingURL=GMXService.js.map