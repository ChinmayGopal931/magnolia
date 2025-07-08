import { GmxSdk } from '@gmx-io/sdk';
import { createPublicClient, http, createWalletClient, custom } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { Address, Account } from 'viem';
import { config } from '../../config';
import winston from 'winston';

// Create a logger instance if not imported
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

export interface GMXPosition {
  id: string;
  account: string;
  marketAddress: string;
  collateralToken: string;
  indexToken: string;
  isLong: boolean;
  sizeInUsd: string;
  sizeInTokens: string;
  collateralAmount: string;
  entryPrice: string;
  markPrice: string;
  liquidationPrice: string;
  leverage: string;
  pnl: string;
  pnlPercentage: string;
  status: string;
}

export interface GMXMarketInfo {
  marketAddress: string;
  indexToken: string;
  longToken: string;
  shortToken: string;
  marketTokenAddress: string;
  name: string;
  data: any; // Full market data
}

export interface GMXOrderParams {
  marketAddress: string;
  payTokenAddress: string;
  collateralTokenAddress: string;
  indexTokenAddress?: string;
  payAmount: string;
  sizeDelta?: string;
  sizeDeltaUsd?: string;
  initialCollateralDelta?: string;
  acceptablePrice?: string;
  leverage: string | number;
  allowedSlippageBps: number;
  isLong?: boolean;
  triggerPrice?: string;
  executionFee?: string;
  callbackGasLimit?: string;
  // Account address for the transaction (required by GMX SDK)
  account?: string;
  // Legacy parameters for backward compatibility
  initialCollateralAddress?: string;
  initialCollateralAmount?: string;
}

/**
 * Service for interacting with GMX protocol
 */
export class GMXService {
  private static instance: GMXService;

  private sdk: GmxSdk | null = null;
  private publicClient: any;
  private marketsInfo: any = null;
  private tokensData: any = null;
  private walletAddress: string | null = null;
  private isInitialized: boolean = false;

  private constructor() {
    // Initialize public client for read operations
    this.publicClient = createPublicClient({
      chain: avalancheFuji,
      transport: http(config.gmx.rpcUrl)
    });
  }

  public static getInstance(): GMXService {
    if (!GMXService.instance) {
      GMXService.instance = new GMXService();
    }
    return GMXService.instance;
  }

  /**
   * Create a new wallet-connected GMXService instance for trading operations
   * This bypasses the singleton pattern to allow per-wallet instances
   */
  public static createWalletInstance(): GMXService {
    return new GMXService();
  }

  /**
   * Initialize the GMX SDK with a wallet client
   * @param walletAddress The user's wallet address
   * @param provider The wallet provider (e.g., from MetaMask)
   */
  async initializeReadOnly(): Promise<void> {
    try {
      // For read-only operations, we can initialize the SDK without a signer
      // by creating a public client and passing it. The SDK may require a walletClient
      // interface, so we create one that is essentially read-only.
      this.sdk = new GmxSdk({
        chainId: config.gmx.chainId,
        rpcUrl: config.gmx.rpcUrl,
        oracleUrl: config.gmx.oracleUrl,
        subsquidUrl: config.gmx.subsquidUrl,
        walletClient: this.publicClient, // Use public client for read-only init
      });

      await this.loadMarketData();
      logger.info('GMX SDK initialized in read-only mode.');
    } catch (error) {
      logger.error('Failed to initialize GMX SDK in read-only mode:', error);
      throw new Error(`Failed to initialize GMX SDK in read-only mode: ${error}`);
    }
  }

  async initialize(walletAddress: string, provider: any): Promise<void> {
    try {
      // Create a wallet client using the provider
      const walletClient = createWalletClient({
        account: walletAddress as Address,
        chain: avalancheFuji,
        transport: custom(provider)
      });

      // Initialize the GMX SDK
      this.sdk = new GmxSdk({
        chainId: config.gmx.chainId,
        rpcUrl: config.gmx.rpcUrl,
        oracleUrl: config.gmx.oracleUrl,
        walletClient,
        subsquidUrl: config.gmx.subsquidUrl
      });
      
      // Load market data after SDK initialization
      await this.loadMarketData();
      
      this.walletAddress = walletAddress;
      this.isInitialized = true;
      logger.info(`GMX SDK initialized for wallet: ${walletAddress}`);
    } catch (error) {
      logger.error('Failed to initialize GMX SDK with wallet:', error);
      throw new Error(`Failed to initialize GMX SDK with wallet: ${error}`);
    }
  }

  /**
   * Initialize GMX SDK for transaction creation (without provider)
   * This creates a wallet client that can create transactions but not sign them
   */
  async initializeForTransactions(walletAddress: string): Promise<void> {
    try {
      logger.info(`Initializing GMX SDK for transactions with wallet: ${walletAddress}`);
      
      // Create a temporary wallet client using public transport
      // This allows us to create transactions without needing browser provider
      const walletClient = createWalletClient({
        account: walletAddress as Address,
        chain: avalancheFuji,
        transport: http(config.gmx.rpcUrl)
      });

      // Initialize the GMX SDK
      this.sdk = new GmxSdk({
        chainId: config.gmx.chainId,
        rpcUrl: config.gmx.rpcUrl,
        oracleUrl: config.gmx.oracleUrl,
        walletClient,
        subsquidUrl: config.gmx.subsquidUrl
      });
      
      logger.info('GMX SDK instance created, loading market data...');

      // Load markets and tokens data with retry logic
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          await this.loadMarketData();
          break; // Success, exit retry loop
        } catch (marketDataError) {
          retryCount++;
          logger.warn(`Market data loading attempt ${retryCount} failed:`, marketDataError);
          
          if (retryCount >= maxRetries) {
            throw marketDataError; // Re-throw on final failure
          }
          
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
      
      // Final validation
      if (!this.marketsInfo || !this.tokensData) {
        throw new Error('Market data validation failed after successful loading');
      }
      
      logger.info(`GMX SDK initialized successfully for transactions with wallet: ${walletAddress}`);
    } catch (error) {
      logger.error('Failed to initialize GMX SDK for transactions:', error);
      // Reset state on failure
      this.sdk = null;
      this.marketsInfo = null;
      this.tokensData = null;
      throw new Error(`Failed to initialize GMX SDK for transactions: ${error}`);
    }
  }

  /**
   * Load market data required for most GMX operations
   */
  private async loadMarketData(): Promise<void> {
    try {
      if (!this.sdk) {
        throw new Error('GMX SDK not initialized');
      }
      
      logger.info('Loading GMX market data...');
      
      // Use the correct method from GMX SDK
      const result = await this.sdk.markets.getMarketsInfo();
      
      if (!result || !result.marketsInfoData || !result.tokensData) {
        throw new Error('Invalid market data response from GMX SDK');
      }
      
      this.marketsInfo = result.marketsInfoData;
      this.tokensData = result.tokensData;
      
      // Validate that we actually have data
      if (!this.marketsInfo || Object.keys(this.marketsInfo).length === 0) {
        throw new Error('Markets info data is empty');
      }
      
      if (!this.tokensData || Object.keys(this.tokensData).length === 0) {
        throw new Error('Tokens data is empty');
      }
      
      logger.info('GMX market data loaded successfully', {
        marketsCount: Object.keys(this.marketsInfo).length,
        tokensCount: Object.keys(this.tokensData).length
      });
      
      // Log available tokens for debugging
      this.logAvailableTokens();
      
      // Log available markets for debugging
      this.logAvailableMarkets();
    } catch (error) {
      logger.error('Failed to load market data:', error);
      // Reset the data to null on failure
      this.marketsInfo = null;
      this.tokensData = null;
      throw new Error(`Failed to load market data: ${error}`);
    }
  }

  /**
   * Log available tokens for debugging
   */
  private logAvailableTokens(): void {
    if (!this.tokensData) return;
    
    const tokenSymbols = Object.values(this.tokensData)
      .map((token: any) => `${token.symbol} (${token.address})`)
      .join(', ');
    
    logger.debug(`Available tokens: ${tokenSymbols}`);
  }
  
  /**
   * Log available markets for debugging
   * @param targetMarketAddress Optional target market address to check for
   */
  private logAvailableMarkets(targetMarketAddress?: string): void {
    if (!this.marketsInfo) return;
    
    const marketAddresses = Object.keys(this.marketsInfo);
    logger.info(`Available markets (${marketAddresses.length}):\n${marketAddresses.join('\n')}`);
    
    // Check if target market exists and log detailed info
    if (targetMarketAddress) {
      const targetExists = marketAddresses.some(address => 
        address.toLowerCase() === targetMarketAddress.toLowerCase()
      );
      
      logger.info(`Target market ${targetMarketAddress} exists: ${targetExists}`);
      
      if (!targetExists) {
        // Try to find similar addresses to help identify potential typos
        const similarAddresses = marketAddresses.filter(address => 
          address.substring(0, 8) === targetMarketAddress.substring(0, 8) ||
          address.substring(address.length - 8) === targetMarketAddress.substring(targetMarketAddress.length - 8)
        );
        
        if (similarAddresses.length > 0) {
          logger.info(`Found similar market addresses that might be what you're looking for:\n${similarAddresses.join('\n')}`);
        }
      }
    }
  }
  
  /**
   * Normalize and validate a market address
   * Checks if the provided market address exists in marketsInfo and attempts to find a match
   * with case-insensitive comparison or by finding a similar address
   * @param marketAddress The market address to validate
   * @returns The normalized market address if found, or the original address if not found
   */
  private normalizeMarketAddress(marketAddress: string): string {
    if (!marketAddress) return marketAddress;
    
    // Always convert to lowercase for consistent comparison
    const normalizedAddress = marketAddress.toLowerCase();
    
    // If marketsInfo is not loaded, just return the lowercase version
    if (!this.marketsInfo) {
      return normalizedAddress;
    }
    
    // Check if the normalized address exists directly in marketsInfo
    if (this.marketsInfo[normalizedAddress]) {
      return normalizedAddress;
    }
    
    // If not found directly, try to find similar addresses
    const marketAddresses = Object.keys(this.marketsInfo);
    const similarAddresses = marketAddresses.filter(address => 
      address.toLowerCase() === normalizedAddress ||
      address.substring(0, 8).toLowerCase() === normalizedAddress.substring(0, 8) ||
      address.substring(address.length - 8).toLowerCase() === normalizedAddress.substring(normalizedAddress.length - 8)
    );
    
    if (similarAddresses.length === 1) {
      logger.info(`Found similar market address that might be what you're looking for: ${marketAddress} -> ${similarAddresses[0]}`);
      return similarAddresses[0];
    } else if (similarAddresses.length > 1) {
      logger.warn(`Multiple similar market addresses found for ${marketAddress}. Using original address.`);
    }
    
    return normalizedAddress;
  }
  
  /**
   * Helper method to extract available tokens from tokensData
   */
  private getAvailableTokensInternal(): {address: string, symbol: string, decimals: number}[] {
    const availableTokens: {address: string, symbol: string, decimals: number}[] = [];
      
    if (!this.tokensData) {
      return availableTokens;
    }
      
    // Extract token information
    Object.entries(this.tokensData).forEach(([address, data]: [string, any]) => {
      if (data && data.symbol) {
        availableTokens.push({
          address: address,
          symbol: data.symbol,
          decimals: data.decimals || 18
        });
      }
    });
    
    return availableTokens;
  }
  
  /**
   * Get all available tokens from the GMX SDK
   * @returns List of available tokens with their addresses and symbols
   */
  async getAvailableTokens(): Promise<{address: string, symbol: string, decimals: number}[]> {
    if (!this.tokensData) {
      await this.loadMarketData();
    }
    
    return this.getAvailableTokensInternal();
  }

  /**
   * Get all available markets
   * @returns List of market information
   */
  async getMarkets(): Promise<GMXMarketInfo[]> {
    if (!this.marketsInfo) {
      await this.loadMarketData();
    }

    try {
      return Object.values(this.marketsInfo).map((market: any) => ({
        marketAddress: market.marketTokenAddress,
        indexToken: market.indexToken.symbol,
        longToken: market.longToken.symbol,
        shortToken: market.shortToken.symbol,
        marketTokenAddress: market.marketTokenAddress,
        name: market.name,
        data: market // Include full market data
      }));
    } catch (error) {
      logger.error('Failed to get GMX markets:', error);
      throw new Error(`Failed to get GMX markets: ${error}`);
    }
  }

  /**
   * Get all positions for a wallet address
   * @param walletAddress The wallet address to get positions for
   * @returns List of positions
   */
  async getPositions(walletAddress: string): Promise<GMXPosition[]> {
    if (!this.sdk) {
      throw new Error('GMX SDK not initialized');
    }

    if (!this.marketsInfo) {
      await this.loadMarketData();
    }

    try {
      // Check if we're on Fuji testnet and handle known contract limitations
      const chainId = config.gmx.chainId;
      if (chainId === 43113) { // Avalanche Fuji testnet
        logger.info(`Using Fuji testnet (${chainId}). Positions may not be fully supported.`);
        // For debugging
        logger.info(`Attempting to get positions for account: ${walletAddress}`);
      }
      
      try {
        // Ensure wallet address is valid and properly formatted
        if (!walletAddress || walletAddress === '0x0000000000000000000000000000000000000000') {
          logger.warn('Invalid wallet address provided for positions lookup');
          return []; // Return empty array for invalid addresses
        }
        
        // Log the parameters we're passing to help debug the undefined parameter issue
        logger.info('Calling getPositions with parameters:', {
          hasMarketsData: !!this.marketsInfo,
          marketsDataKeys: this.marketsInfo ? Object.keys(this.marketsInfo).length : 0,
          hasTokensData: !!this.tokensData,
          tokensDataKeys: this.tokensData ? Object.keys(this.tokensData).length : 0,
          account: walletAddress
        });
        
        // @ts-ignore - The SDK types don't match the actual API
        const positionsResult = await this.sdk.positions.getPositions({
          marketsData: this.marketsInfo, // Using correct parameter name per IDE feedback
          tokensData: this.tokensData,
          // @ts-ignore - The SDK types don't match the actual API
          account: walletAddress as Address,
          // Ensure we pass empty arrays for these parameters rather than undefined
          markets: [],
          filters: []
        });

        // Convert positions to our format
        const positionsList = Array.isArray(positionsResult) ? positionsResult : [];
        logger.info(`Retrieved ${positionsList.length} positions for ${walletAddress}`);
        
        return positionsList.map((position: any) => ({
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
      } catch (positionError: any) {
        // If this is a contract call error related to getAccountPositionInfoList
        if (positionError.message && positionError.message.includes('getAccountPositionInfoList')) {
          logger.warn(`Contract call to getAccountPositionInfoList failed. This may be expected on Fuji testnet: ${positionError.message}`);
          return []; // Return empty array instead of failing
        }
        // Otherwise, propagate the error
        throw positionError;
      }
    } catch (error) {
      logger.error(`Failed to get positions for ${walletAddress}:`, error);
      throw new Error(`Failed to get positions: ${error}`);
    }
  }

  /**
   * Create a long position
   * @param params Order parameters
   * @returns Transaction hash
   */
  async createLongPosition(params: GMXOrderParams): Promise<string> {
    // Enhanced validation with detailed error messages
    if (!this.sdk) {
      logger.error('GMX SDK not initialized when creating long position');
      throw new Error('GMX SDK not initialized');
    }
    
    if (!this.marketsInfo) {
      logger.error('Markets info not available when creating long position');
      throw new Error('Markets info not available. Please ensure market data is loaded.');
    }
    
    if (!this.tokensData) {
      logger.error('Tokens data not available when creating long position');
      throw new Error('Tokens data not available. Please ensure market data is loaded.');
    }
    
    // Constants for token addresses
    const NATIVE_AVAX_PLACEHOLDER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const WAVAX_ADDRESS = '0xd00ae08403B9bbb9124bB305C09058E32C39A48c'; // Wrapped AVAX on Fuji testnet
    
    // Log the state for debugging
    logger.info('Market data validation passed', {
      marketsInfoKeys: Object.keys(this.marketsInfo).length,
      tokensDataKeys: Object.keys(this.tokensData).length
    });
      
    // Log available markets for debugging
    this.logAvailableMarkets(params.marketAddress);
    
    // Try to normalize the market address to handle case sensitivity or similar addresses
    const normalizedMarketAddress = this.normalizeMarketAddress(params.marketAddress);
    
    // Check if normalization found a different address
    if (normalizedMarketAddress !== params.marketAddress) {
      logger.info(`Using normalized market address: ${normalizedMarketAddress} instead of ${params.marketAddress}`);
      params.marketAddress = normalizedMarketAddress;
    }
    
    // Extract account parameter from request body
    const account = params.account as Address;
    if (!account) {
      throw new Error('account parameter is required for GMX operations');
    }
    
    try {
      // Check if we need to swap AVAX to WAVAX first
      let actualPayAmount = params.payAmount;
      let actualPayTokenAddress = params.payTokenAddress;
      
      // If paying with native AVAX, swap to WAVAX first
      if (params.payTokenAddress === NATIVE_AVAX_PLACEHOLDER) {
        logger.info('Native AVAX detected as pay token, swapping to WAVAX first');
        
        try {
          const swapResult = await this.swapAvaxToWavax({
            amount: params.payAmount,
            account: account
          });
          
          logger.info(`Successfully swapped AVAX to WAVAX: ${swapResult}`);
          
          // Update pay token to WAVAX for the position creation
          actualPayTokenAddress = WAVAX_ADDRESS;
        } catch (swapError) {
          logger.error('Failed to swap AVAX to WAVAX:', swapError);
          throw new Error(`Failed to swap AVAX to WAVAX: ${swapError}`);
        }
      }
      
      // Deep clone and convert all BigInt values in marketsInfo and tokensData to strings
      // This is crucial to avoid "Cannot mix BigInt and other types" errors
      
      // Function to deeply convert BigInt values to strings
      const deepConvertBigInts = (obj: any): any => {
        if (obj === null || obj === undefined) {
          return obj;
        }
        
        if (typeof obj === 'bigint') {
          return obj.toString();
        }
        
        if (Array.isArray(obj)) {
          return obj.map(item => deepConvertBigInts(item));
        }
        
        if (typeof obj === 'object') {
          const result: any = {};
          for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
              result[key] = deepConvertBigInts(obj[key]);
            }
          }
          return result;
        }
        
        return obj;
      };
      
      // Create clean copies of markets and tokens data with all BigInts converted to strings
      const formattedMarketsInfoData = deepConvertBigInts(this.marketsInfo);
      const cleanTokensData = deepConvertBigInts(this.tokensData);
      
      // Create order parameters with correct types for the GMX SDK
      // Based on GMX SDK documentation, the SDK expects BigInt values for amounts
      const orderParamsForSdk = {
        account: account,
        marketAddress: params.marketAddress as Address,
        payTokenAddress: actualPayTokenAddress as Address,
        collateralTokenAddress: params.collateralTokenAddress as Address,
        payAmount: BigInt(actualPayAmount), // SDK expects BigInt
        acceptablePrice: params.acceptablePrice ? BigInt(params.acceptablePrice) : 0n, // SDK expects BigInt
        leverage: params.leverage, // SDK expects number for leverage
        allowedSlippageBps: params.allowedSlippageBps || 50, // SDK expects number for slippage
        marketsInfoData: this.marketsInfo, // Use original marketsInfo with BigInt values intact
        tokensData: this.tokensData // Use original tokensData with BigInt values intact
      };
      
      // Log the sanitized parameters for debugging
      logger.info('Creating long position with sanitized params:', {
        account: orderParamsForSdk.account,
        payAmount: orderParamsForSdk.payAmount,
        marketAddress: orderParamsForSdk.marketAddress,
        leverage: orderParamsForSdk.leverage,
        allowedSlippageBps: orderParamsForSdk.allowedSlippageBps,
        marketsInfoDataSanitized: true,
        tokensDataSanitized: true
      });
      
      // Log the types of each parameter for debugging
      logger.info('Parameter types:', {
        account: typeof orderParamsForSdk.account,
        payAmount: typeof orderParamsForSdk.payAmount,
        marketAddress: typeof orderParamsForSdk.marketAddress,
        leverage: typeof orderParamsForSdk.leverage,
        allowedSlippageBps: typeof orderParamsForSdk.allowedSlippageBps,
        marketsInfoData: typeof orderParamsForSdk.marketsInfoData,
        tokensData: typeof orderParamsForSdk.tokensData
      });
      
      // Check if marketsInfoData or tokensData contain any BigInt values
      const checkForBigInt = (obj: any, path = ''): string[] => {
        const results: string[] = [];
        if (obj === null || obj === undefined) return results;
        
        if (typeof obj === 'bigint') {
          results.push(`${path}: bigint`);
          return results;
        }
        
        if (Array.isArray(obj)) {
          obj.forEach((item, index) => {
            results.push(...checkForBigInt(item, `${path}[${index}]`));
          });
          return results;
        }
        
        if (typeof obj === 'object') {
          Object.entries(obj).forEach(([key, value]) => {
            results.push(...checkForBigInt(value, path ? `${path}.${key}` : key));
          });
          return results;
        }
        
        return results;
      };
      
      // Sample check for BigInt in the first few items of marketsInfoData and tokensData
      const sampleMarketsInfoCheck = checkForBigInt(orderParamsForSdk.marketsInfoData).slice(0, 5);
      const sampleTokensDataCheck = checkForBigInt(orderParamsForSdk.tokensData).slice(0, 5);
      
      logger.info('Sample BigInt check:', {
        marketsInfoSample: sampleMarketsInfoCheck,
        tokensDataSample: sampleTokensDataCheck
      });
      
      try {
        // Use the SDK interface with BigInt parameters as expected by the SDK
        // @ts-ignore - SDK types don't match actual implementation
        const result: any = await this.sdk.orders.long(orderParamsForSdk);
        
        // @ts-ignore - SDK types don't match actual implementation
        const txnHash = result?.txnHash;
        
        if (!txnHash) {
          throw new Error('No transaction hash returned from GMX SDK');
        }
        
        logger.info(`Long position order created successfully: ${txnHash}`);
        return txnHash;
      } catch (sdkError) {
        const errorStr = sdkError instanceof Error ? sdkError.message : String(sdkError);
        logger.error('SDK error details:', { error: errorStr });
        throw new Error(`Failed to create long position: ${errorStr}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Unexpected error in createLongPosition:', errorMessage, error instanceof Error ? error.stack : '');
      throw new Error(`Unexpected error in createLongPosition: ${errorMessage}`);
    }
  }

  /**
   * Create a short position
   * @param params Order parameters
   * @returns Transaction hash
   */
  async createShortPosition(params: GMXOrderParams): Promise<string> {
    if (!this.sdk || !this.marketsInfo || !this.tokensData) {
      throw new Error('GMX SDK or market data not initialized');
    }

    try {
      // Use new parameters that match GMX SDK requirements
      const orderParams = {
        payAmount: BigInt(params.payAmount),
        marketAddress: params.marketAddress as Address,
        payTokenAddress: params.payTokenAddress as Address,
        collateralTokenAddress: params.collateralTokenAddress as Address,
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
    } catch (error) {
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
  async closePosition(
    marketAddress: string,
    isLong: boolean,
    sizeDeltaUsd: string,
    acceptablePrice: string
  ): Promise<string> {
    if (!this.sdk || !this.marketsInfo || !this.tokensData) {
      throw new Error('GMX SDK or market data not initialized');
    }

    try {
      // Find market info
      const marketInfo = Object.values(this.marketsInfo).find(
        (m: any) => m.marketTokenAddress.toLowerCase() === marketAddress.toLowerCase()
      ) as any; // Using any type since GMX SDK types are not fully defined
      
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
        } as any,
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
    } catch (error) {
      logger.error('Failed to close position:', error);
      throw new Error(`Failed to close position: ${error}`);
    }
  }

  /**
   * Cancel an order
   * @param orderKey The key of the order to cancel
   * @returns Transaction hash
   */
  async cancelOrder(orderKey: string): Promise<string> {
    if (!this.sdk) {
      throw new Error('GMX SDK not initialized');
    }

    try {
      const result = await this.sdk.orders.cancelOrders([orderKey]);
      const txnHash = result.toString();
      logger.info(`Cancelled order ${orderKey}, txn: ${txnHash}`);
      return txnHash;
    } catch (error) {
      logger.error(`Failed to cancel order ${orderKey}:`, error);
      throw new Error(`Failed to cancel order: ${error}`);
    }
  }

  /**
   * Swap tokens
   * @param params Swap parameters
   * @returns Transaction hash
   */
  /**
   * Swap tokens on GMX
   * @param params Swap parameters
   * @returns Transaction hash
   */
  async swapTokens(params: {
    fromTokenAddress: string;
    toTokenAddress: string;
    fromAmount: string;
    account?: string; // Added account parameter for wallet address
  }): Promise<string> {
    if (!this.sdk || !this.marketsInfo || !this.tokensData) {
      throw new Error('GMX SDK or market data not initialized');
    }

    try {
      // Log the swap parameters for debugging
      logger.info('Attempting token swap with parameters:', {
        fromToken: params.fromTokenAddress,
        toToken: params.toTokenAddress,
        amount: params.fromAmount,
        account: params.account
      });

      const swapParams = {
        fromAmount: BigInt(params.fromAmount),
        fromTokenAddress: params.fromTokenAddress as Address,
        toTokenAddress: params.toTokenAddress as Address,
        allowedSlippageBps: 125, // 1.25% slippage
        marketsInfoData: this.marketsInfo,
        tokensData: this.tokensData,
        account: params.account as Address
      };

      // @ts-ignore - The SDK types don't match the actual API
      const result = await this.sdk.orders.swap(swapParams);
      // @ts-ignore - The SDK types don't match the actual API
      const txnHash = result?.txnHash || '';
      logger.info(`Swapped tokens, txn: ${txnHash}`);
      return txnHash;
    } catch (error) {
      logger.error('Failed to swap tokens:', error);
      throw new Error(`Failed to swap tokens: ${error}`);
    }
  }
  
  /**
   * Swap native AVAX to WAVAX
   * @param params Parameters for the AVAX to WAVAX swap
   * @returns Transaction hash
   */
  async swapAvaxToWavax(params: {
    amount: string;
    account: string;
  }): Promise<string> {
    if (!this.sdk || !this.marketsInfo || !this.tokensData) {
      logger.error('GMX SDK or market data not initialized when swapping AVAX to WAVAX');
      throw new Error('GMX SDK or market data not initialized');
    }

    try {
      logger.info(`Swapping ${params.amount} AVAX to WAVAX for account ${params.account}`);
      
      // Constants for Avalanche Fuji testnet
      const NATIVE_AVAX_PLACEHOLDER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'; // Placeholder for native token
      const WAVAX_ADDRESS = '0xd00ae08403B9bbb9124bB305C09058E32C39A48c'; // Wrapped AVAX on Fuji testnet
      
      // Create swap parameters directly instead of calling swapTokens
      // This gives us more control over the process and error handling
      const swapParams = {
        account: params.account as Address,
        fromTokenAddress: NATIVE_AVAX_PLACEHOLDER as Address,
        toTokenAddress: WAVAX_ADDRESS as Address,
        fromAmount: params.amount, // Pass as string to avoid BigInt mixing issues
        allowedSlippageBps: Number(50), // 0.5% slippage - explicitly convert to Number
        // Deep convert any BigInt values in marketsInfoData and tokensData to strings
        marketsInfoData: this.deepConvertBigInts(this.marketsInfo),
        tokensData: this.deepConvertBigInts(this.tokensData)
      };
      
      // Execute the swap directly with the SDK
      // The SDK's swap method returns a SwapAmounts object which doesn't have txnHash
      // We need to use @ts-ignore to access the txnHash property
      // @ts-ignore - The SDK types don't match the actual API response
      const swapResponse = await this.sdk.orders.swap(swapParams);
      
      if (!swapResponse) {
        throw new Error('No response received from swap operation');
      }
      
      // @ts-ignore - The SDK types don't match the actual API response
      const txnHash = swapResponse.txnHash as string;
      if (!txnHash) {
        throw new Error('No transaction hash returned from swap operation');
      }
      
      logger.info(`Successfully swapped AVAX to WAVAX, txn: ${txnHash}`);
      return txnHash;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to swap AVAX to WAVAX: ${errorMessage}`);
      throw new Error(`Failed to swap AVAX to WAVAX: ${errorMessage}`);
    }
  }

  /**
   * Recursively converts all BigInt values in an object to strings
   * This is necessary to avoid "Cannot mix BigInt and other types" errors when passing objects to GMX SDK
   * @param obj The object to convert
   * @returns A new object with all BigInt values converted to strings
   */
  private deepConvertBigInts(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    // Handle BigInt directly
    if (typeof obj === 'bigint') {
      return obj.toString();
    }
    
    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepConvertBigInts(item));
    }
    
    // Handle objects
    if (typeof obj === 'object') {
      const result: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          result[key] = this.deepConvertBigInts(obj[key]);
        }
      }
      return result;
    }
    
    // Return primitive values as is
    return obj;
  }

  /**
   * Get market info by market address
   * @param marketAddress The market address
   * @returns Market information
   */
  async getMarketInfo(marketAddress: string): Promise<GMXMarketInfo | null> {
    if (!this.marketsInfo) {
      await this.loadMarketData();
    }

    try {
      const market = Object.values(this.marketsInfo).find(
        (m: any) => m.marketTokenAddress.toLowerCase() === marketAddress.toLowerCase()
      ) as any;

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
    } catch (error) {
      logger.error(`Failed to get market info for ${marketAddress}:`, error);
      throw new Error(`Failed to get market info: ${error}`);
    }
  }
}
