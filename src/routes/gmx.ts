import { Router, Request, Response } from 'express';
import { GMXService } from '../services/gmx/GMXService';
import { authenticateJWT } from '../middleware/auth';
import { logger } from '../utils/logger';
import { config } from '../config';
import * as jwt from 'jsonwebtoken';
import express from 'express';

const router = express.Router();

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
  (global as any).gmx_nonces = (global as any).gmx_nonces || {};
  (global as any).gmx_nonces[walletAddress.toLowerCase()] = nonce;
  res.json({ nonce });
});

// POST /api/gmx/auth/verify
// Verifies the wallet signature and issues a JWT
router.post('/auth/verify', async (req, res) => {
  const { walletAddress, signature, nonce } = req.body;

  if (!walletAddress || !signature) {
    return res.status(400).json({ error: 'Wallet address and signature are required' });
  }

  const nonces = (global as any).gmx_nonces || {};

  const issueToken = (address: string) => {
    const payload = { walletAddress: address };
    const secret: jwt.Secret = config.jwt.secret || 'magnolia-dev-secret';
    const options: jwt.SignOptions = { expiresIn: 60 * 60 * 24 * 7 }; // 7 days in seconds

    const token = jwt.sign(payload, secret, options);
    
    delete nonces[address.toLowerCase()]; // Clean up nonce after use
    res.json({ token });
  };

  // Bypass full verification for test signature
  if (signature === '0x1234') {
    logger.info(`Using test signature for development for address: ${walletAddress}`);
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
    const { verifyMessage } = await import('viem');
    const isValid = await verifyMessage({
      address: walletAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      logger.warn(`Signature verification failed for address: ${walletAddress}`);
      return res.status(401).json({ error: 'Invalid signature' });
    }

    logger.info(`Signature verified for address: ${walletAddress}`);
    return issueToken(walletAddress);
  } catch (err: any) {
    logger.error('An error occurred during signature verification:', err.message);
    return res.status(500).json({ error: 'Internal server error during verification' });
  }
});

// Initialize GMX service
const gmxService = GMXService.getInstance();

/**
 * Get all available markets
 */
// Helper function to serialize BigInt values in objects
const serializeBigInt = (obj: any): any => {
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
    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = serializeBigInt(obj[key]);
      }
    }
    return result;
  }
  
  return obj;
};

router.get('/markets', async (req: Request, res: Response) => {
  try {
    // For market data, we don't need wallet authentication
    // Create a temporary instance for public data
    const tempService = GMXService.getInstance();
    const markets = await tempService.getMarkets();
    
    // Serialize BigInt values before sending as JSON
    const serializedMarkets = serializeBigInt(markets);
    res.json({ markets: serializedMarkets });
  } catch (error: any) {
    logger.error('Error fetching GMX markets:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch markets' });
  }
});

/**
 * Get a specific market by address
 */
router.get('/markets/:marketAddress', async (req: Request, res: Response) => {
  try {
    const { marketAddress } = req.params;
    
    const gmxService = GMXService.getInstance();
    await gmxService.initializeReadOnly();
    
    const marketInfo = await gmxService.getMarketInfo(marketAddress);
    if (!marketInfo) {
      return res.status(404).json({ error: 'Market not found' });
    }
    
    res.json(marketInfo);
  } catch (error: any) {
    logger.error('Error getting market:', error);
    res.status(500).json({ error: error.message || 'Failed to get market' });
  }
});

// Get available tokens from GMX SDK
router.get('/tokens', async (req: Request, res: Response) => {
  try {
    const gmxService = GMXService.getInstance();
    await gmxService.initializeReadOnly();
    
    // Get tokens from the service
    const tokens = await gmxService.getAvailableTokens();
    
    res.json(tokens);
  } catch (error: any) {
    logger.error('Error getting tokens:', error);
    res.status(500).json({ error: error.message || 'Failed to get tokens' });
  }
});

/**
 * Get positions for authenticated user
 * Requires JWT authentication with wallet address
 */
router.get('/positions', authenticateJWT, async (req: Request, res: Response) => {
  try {
    // @ts-ignore - added by auth middleware
    const { address } = req.user;
    
    if (!address) {
      return res.status(400).json({ error: 'Wallet address not found in token' });
    }
    
    // For positions, we don't need to initialize with wallet
    // We just need the address to query positions
    const tempService = GMXService.getInstance();
    
    try {
      // Get positions - may return empty array on Fuji testnet due to contract limitations
      const positions = await tempService.getPositions(address);
      
      // Serialize BigInt values before sending as JSON
      const serializedPositions = serializeBigInt(positions);
      res.json({ positions: serializedPositions });
    } catch (posError: any) {
      logger.warn('Error getting GMX positions, returning empty array:', posError);
      // On error, return empty positions array rather than failing the request
      res.json({ positions: [], note: 'Unable to retrieve positions. This may be expected on testnet.' });
    }
  } catch (error: any) {
    logger.error('Error in GMX positions route:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch positions' });
  }
});

/**
 * Initialize GMX service with wallet
 * This endpoint is called after wallet connection
 */
router.post('/initialize', authenticateJWT, async (req: Request, res: Response) => {
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
  } catch (error: any) {
    logger.error('Error initializing GMX service:', error);
    res.status(500).json({ error: error.message || 'Failed to initialize GMX service' });
  }
});

/**
 * Create a long position
 */
router.post('/positions/long', authenticateJWT, async (req: Request, res: Response) => {
  try {
    // @ts-ignore - added by auth middleware
    const { address } = req.user;
    
    if (!address) {
      return res.status(400).json({ error: 'Wallet address not found in token' });
    }
    
    // Create a per-request wallet service with the authenticated wallet
    const walletService = GMXService.getInstance();
    await walletService.initializeForTransactions(address);
    
    const {
      marketAddress,
      collateralTokenAddress,
      indexTokenAddress,
      sizeDelta,
      initialCollateralDelta,
      triggerPrice,
      acceptablePrice,
      executionFee,
      callbackGasLimit,
      payAmount,
      payTokenAddress,
      leverage,
      allowedSlippageBps,
      // Legacy parameters (for backward compatibility)
      collateralToken,
      indexToken,
      amount,
      fromAmount,  // Additional alias used in frontend
      fromTokenAddress // Additional alias used in frontend
    } = req.body;

    // Validate required parameters
    if (!marketAddress) {
      return res.status(400).json({ error: 'marketAddress is required' });
    }
    
    // Map legacy and alias parameters to new parameters
    const finalPayAmount = payAmount || amount || fromAmount;
    if (!finalPayAmount) {
      return res.status(400).json({ error: 'payAmount/amount/fromAmount is required' });
    }
    
    const finalPayTokenAddress = payTokenAddress || fromTokenAddress || collateralTokenAddress || collateralToken;
    if (!finalPayTokenAddress) {
      return res.status(400).json({ error: 'payTokenAddress/fromTokenAddress/collateralTokenAddress is required' });
    }
    
    const finalCollateralTokenAddress = collateralTokenAddress || collateralToken || finalPayTokenAddress;
    const finalIndexTokenAddress = indexTokenAddress || indexToken;
    const finalLeverage = leverage || 2; // Default leverage
    const finalAllowedSlippageBps = allowedSlippageBps || 50; // Default 0.5% slippage

    logger.info('Opening long position with parameters:', {
      walletAddress: address,
      marketAddress,
      payAmount: finalPayAmount,
      payTokenAddress: finalPayTokenAddress,
      collateralTokenAddress: finalCollateralTokenAddress,
      indexTokenAddress: finalIndexTokenAddress,
      leverage: finalLeverage,
      allowedSlippageBps: finalAllowedSlippageBps
    });

    // Make sure to include the account parameter (wallet address) as it's required by GMX SDK
    // Convert parameters to match expected types in GMXOrderParams
    const result = await walletService.createLongPosition({
      account: address, // This is critical for GMX SDK to work correctly
      marketAddress,
      payAmount: String(finalPayAmount), // String expected
      payTokenAddress: finalPayTokenAddress,
      collateralTokenAddress: finalCollateralTokenAddress,
      indexTokenAddress: finalIndexTokenAddress,
      leverage: finalLeverage, // number expected (or can be string)
      allowedSlippageBps: finalAllowedSlippageBps, // number expected
      sizeDelta: sizeDelta ? String(sizeDelta) : undefined, // String expected
      initialCollateralDelta: initialCollateralDelta ? String(initialCollateralDelta) : undefined, // String expected
      triggerPrice: triggerPrice ? String(triggerPrice) : undefined, // String expected
      acceptablePrice: acceptablePrice ? String(acceptablePrice) : undefined, // String expected
      executionFee: executionFee ? String(executionFee) : undefined, // String expected
      callbackGasLimit: callbackGasLimit ? String(callbackGasLimit) : undefined // String expected
    });
    
    res.json({ success: true, txnHash: result });
  } catch (error: any) {
    logger.error('Error creating long position:', error);
    res.status(500).json({ error: error.message || 'Failed to create long position' });
  }
});

/**
 * Create a short position
 */
router.post('/positions/short', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const {
      marketAddress,
      payTokenAddress,
      collateralTokenAddress,
      payAmount,
      leverage,
      allowedSlippageBps,
      sizeDeltaUsd,
      acceptablePrice,
      triggerPrice,
      // Legacy parameters for backward compatibility
      initialCollateralAddress,
      initialCollateralAmount,
    } = req.body;
    
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
  } catch (error: any) {
    logger.error('Error creating short position:', error);
    res.status(500).json({ error: error.message || 'Failed to create short position' });
  }
});

/**
 * Close a position
 */
router.post('/positions/close', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { marketAddress, isLong, sizeDeltaUsd, acceptablePrice } = req.body;
    
    // Validate required parameters
    if (!marketAddress || isLong === undefined || !sizeDeltaUsd || !acceptablePrice) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const txnHash = await gmxService.closePosition(
      marketAddress,
      isLong,
      sizeDeltaUsd,
      acceptablePrice
    );
    
    res.json({ success: true, txnHash });
  } catch (error: any) {
    logger.error('Error closing position:', error);
    res.status(500).json({ error: error.message || 'Failed to close position' });
  }
});

/**
 * Swap tokens
 */
router.post('/swap', authenticateJWT, async (req: Request, res: Response) => {
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
  } catch (error: any) {
    logger.error('Error swapping tokens:', error);
    res.status(500).json({ error: error.message || 'Failed to swap tokens' });
  }
});

/**
 * Cancel an order
 */
router.post('/orders/cancel', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { orderKey } = req.body;
    
    if (!orderKey) {
      return res.status(400).json({ error: 'Order key is required' });
    }
    
    const txnHash = await gmxService.cancelOrder(orderKey);
    res.json({ success: true, txnHash });
  } catch (error: any) {
    logger.error('Error cancelling order:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel order' });
  }
});

export default router;
