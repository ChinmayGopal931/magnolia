import { ethers } from 'ethers';
import * as hl from '@nktkas/hyperliquid';
import { AgentWallet, OrderParams, MarketData, Position } from '../../types';
import { AgentRepository, PositionRepository } from '../../db/repositories';
import { HyperliquidAPI } from '../../utils/hyperliquid-api';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

export class HyperliquidService {
  private transport: hl.HttpTransport;
  private infoClient: hl.InfoClient;
  private useTestnet: boolean;
  private agentRepository: AgentRepository;
  private positionRepository: PositionRepository;
  
  constructor(useTestnet: boolean = true) {
    this.useTestnet = useTestnet;
    this.transport = new hl.HttpTransport({
      isTestnet: useTestnet
    });
    this.infoClient = new hl.InfoClient({ transport: this.transport });
    this.agentRepository = new AgentRepository();
    this.positionRepository = new PositionRepository();
  }
  
  async generateAgent(userId: string): Promise<AgentWallet> {
    const wallet = ethers.Wallet.createRandom();
    
    // Store in database
    const agentId = await this.agentRepository.create(
      userId, 
      'hyperliquid', 
      wallet.address.toLowerCase(), 
      'pending_approval'
    );
    
    // For now, store private key in environment or encrypted in DB
    // In production, use AWS KMS or similar
    await this.agentRepository.updatePrivateKey(agentId, wallet.privateKey); // TODO: Encrypt this!
    
    logger.info(`Generated new agent wallet for user ${userId}: ${wallet.address}`);
    
    return {
      id: agentId,
      address: wallet.address.toLowerCase(),
      dex: 'hyperliquid',
      userId,
      isApproved: false,
    };
  }
  
/**
 * Approve agent using a signature passed from the frontend
 */

async approveAgent(
  agentId: string, 
  signature: string, 
  agentName?: string,
  action?: any  // Add action parameter
): Promise<{ success: boolean; error?: string; needsDeposit?: boolean }> {
  try {
    // Get the agent details
    const agent = await this.agentRepository.getById(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    // Use the updated HyperliquidAPI.approveAgent method
    const result = await HyperliquidAPI.approveAgent({
      agentAddress: agent.address,
      agentName: agentName,
      signature: signature,
      useTestnet: this.useTestnet,
      action: action // Pass the action parameter
    });

    // If successful, update the agent status using the existing approve method
    if (result.success) {
      await this.agentRepository.approve(agentId); // ✅ Use the existing approve method
    }

    return result;
  } catch (error: any) {
    console.error('Error in HyperliquidService.approveAgent:', error);
    return {
      success: false,
      error: error.message || 'Failed to approve agent'
    };
  }
}
  async openPosition(agentId: string, params: OrderParams): Promise<any> {
    try {
      // Get agent details including private key
      const agent = await this.agentRepository.getApproved(agentId);
      
      if (!agent) {
        throw new Error('Approved agent not found');
      }
      
      const privateKey = agent.private_key_encrypted as string; // TODO: Decrypt this!
      
      const exchangeClient = new hl.ExchangeClient({
        wallet: new ethers.Wallet(privateKey),
        transport: this.transport,
        isTestnet: this.useTestnet
      });
      
      // Get asset index
      const meta = await this.infoClient.meta();
      const assetIndex = meta.universe.findIndex((a: any) => a.name === params.coin);
      
      if (assetIndex === -1) {
        throw new Error(`Asset ${params.coin} not found`);
      }
      
      // Build order according to SDK format - don't use OrderRequest type
      const order = {
        a: assetIndex,
        b: params.side === 'buy',
        p: params.isMarket ? '0' : (params.price || '0'),
        s: params.size,
        r: params.reduceOnly || false,
        t: params.isMarket 
          ? { limit: { tif: 'Ioc' as const } } // Market orders use IOC
          : { limit: { tif: 'Gtc' as const } } // Limit orders use GTC
      };
      
      logger.info(`Opening position: ${JSON.stringify(order)}`);
      
      const result = await exchangeClient.order({
        orders: [order],
        grouping: 'na' as const
      });
      
      // Store position in database
      await this.positionRepository.create(
        agent.user_id,
        agentId,
        'hyperliquid',
        params.coin,
        params.side === 'buy' ? 'long' : 'short',
        params.size,
        params.leverage || 1
      );
      
      return result;
    } catch (error) {
      logger.error('Error opening position:', error);
      throw error;
    }
  }
  
  async closePosition(positionId: string): Promise<any> {
    try {
      // Get position details
      const position = await this.positionRepository.getWithAgentKey(positionId);
      
      if (!position) {
        throw new Error('Open position not found');
      }
      
      const privateKey = position.private_key_encrypted as string; // TODO: Decrypt!
      
      const exchangeClient = new hl.ExchangeClient({
        wallet: new ethers.Wallet(privateKey),
        transport: this.transport,
        isTestnet: this.useTestnet
      });
      
      // Get asset index
      const meta = await this.infoClient.meta();
      const assetIndex = meta.universe.findIndex((a: any) => a.name === position.coin);
      
      // Create closing order (opposite side, reduce only)
      const order = {
        a: assetIndex,
        b: position.side === 'short', // Opposite side
        p: '0', // Market order
        s: position.size, // Database stores it as string already
        r: true, // Reduce only
        t: { limit: { tif: 'Ioc' as const } } // IOC for immediate execution
      };
      
      const result = await exchangeClient.order({
        orders: [order],
        grouping: 'na' as const
      });
      
      // Update position status
      await this.positionRepository.close(positionId);
      
      logger.info(`Closed position ${positionId}`);
      return result;
    } catch (error) {
      logger.error('Error closing position:', error);
      throw error;
    }
  }
  
  async getPositions(userId: string): Promise<Position[]> {
    const rows = await this.positionRepository.getUserOpenPositions(userId);
    
    // Also fetch real-time position data from Hyperliquid
    const positions: Position[] = [];
    for (const row of rows) {
      try {
        const state = await this.infoClient.clearinghouseState({ 
          user: row.agent_address as `0x${string}`
        });
        
        // Find matching position in clearinghouse state
        const hlPosition = state.assetPositions.find(
          (ap: any) => ap.position.coin === row.coin
        );
        
        const position: Position = {
          id: row.id,
          userId: row.user_id,
          agentId: row.agent_id,
          dex: row.dex,
          coin: row.coin,
          side: row.side,
          size: row.size,
          entryPrice: row.entry_price ? row.entry_price.toString() : undefined,
          leverage: row.leverage || 1,
          stopLossPrice: row.stop_loss_price || undefined,
          status: row.status,
          openedAt: row.opened_at,
          closedAt: row.closed_at,
          agentAddress: row.agent_address
        };
        
        if (hlPosition) {
          positions.push({
            ...position,
            // Note: The actual property names from the SDK
            currentPrice: hlPosition.position.positionValue,
            unrealizedPnl: hlPosition.position.unrealizedPnl,
            liquidationPrice: hlPosition.position.liquidationPx,
            marginUsed: hlPosition.position.marginUsed,
          });
        } else {
          positions.push(position);
        }
      } catch (error) {
        logger.error(`Error fetching position data for ${row.id}:`, error);
        const position: Position = {
          id: row.id,
          userId: row.user_id,
          agentId: row.agent_id,
          dex: row.dex,
          coin: row.coin,
          side: row.side,
          size: row.size,
          entryPrice: row.entry_price ? row.entry_price.toString() : undefined,
          leverage: row.leverage || 1,
          stopLossPrice: row.stop_loss_price || undefined,
          status: row.status,
          openedAt: row.opened_at,
          closedAt: row.closed_at,
          agentAddress: row.agent_address
        };
        positions.push(position);
      }
    }
    
    return positions;
  }
  
  async getMarketData(coin: string): Promise<MarketData> {
    try {
      const [allMids, metaAndCtxs] = await Promise.all([
        this.infoClient.allMids(),
        this.infoClient.metaAndAssetCtxs()
      ]);
      
      const assetIndex = metaAndCtxs[0].universe.findIndex(
        (a: any) => a.name === coin
      );
      
      if (assetIndex === -1) {
        throw new Error(`Asset ${coin} not found`);
      }
      
      const assetCtx = metaAndCtxs[1][assetIndex];
      
      return {
        coin,
        price: allMids[coin],
        fundingRate: assetCtx.funding,
        markPrice: assetCtx.markPx,
        openInterest: assetCtx.openInterest,
      };
    } catch (error) {
      logger.error(`Error fetching market data for ${coin}:`, error);
      throw error;
    }
  }

  private formatPriceForHyperliquid(price: number | string, szDecimals: number): string {
    const MAX_DECIMALS = 6; // For perpetuals
    const MAX_SIG_FIGS = 5;
    const maxDecimalPlaces = MAX_DECIMALS - szDecimals;
    
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    
    // Handle integer prices (always allowed)
    if (numPrice === Math.floor(numPrice)) {
      return numPrice.toString();
    }
    
    // Format to appropriate decimal places
    let formatted = numPrice.toFixed(maxDecimalPlaces);
    formatted = formatted.replace(/\.?0+$/, ''); // Remove trailing zeros
    
    // Check significant figures
    const sigFigs = formatted.replace(/^0+\.?0*/, '').replace(/\./g, '').length;
    
    if (sigFigs > MAX_SIG_FIGS) {
      const precision = Math.min(maxDecimalPlaces, MAX_SIG_FIGS - Math.floor(Math.log10(Math.abs(numPrice))) - 1);
      formatted = numPrice.toFixed(Math.max(0, precision));
      formatted = formatted.replace(/\.?0+$/, '');
    }
    
    return formatted;
  }

  async placeOrder(agentId: string, params: {
    asset: number;
    isBuy: boolean;
    price: string;
    size: string;
    reduceOnly?: boolean;
    orderType?: 'limit' | 'market';
    timeInForce?: 'Gtc' | 'Ioc' | 'Alo';
    cloid?: string;
  }): Promise<any> {
    try {
      const agent = await this.agentRepository.getApproved(agentId);
      
      if (!agent) {
        throw new Error('Approved agent not found');
      }
      
      const privateKey = agent.private_key_encrypted as string;
      
      const exchangeClient = new hl.ExchangeClient({
        wallet: new ethers.Wallet(privateKey),
        transport: this.transport,
        isTestnet: this.useTestnet
      });
      
      // Get asset metadata to determine szDecimals
      const meta = await this.infoClient.meta();
      const assetInfo = meta.universe[params.asset];
      
      if (!assetInfo) {
        throw new Error(`Asset index ${params.asset} not found`);
      }
      
      // Format price properly for Hyperliquid
      const formattedPrice = params.orderType === 'market' 
        ? '0' 
        : this.formatPriceForHyperliquid(params.price, assetInfo.szDecimals);
      
      const order = {
        a: params.asset,
        b: params.isBuy,
        p: formattedPrice,
        s: params.size,
        r: params.reduceOnly || false,
        t: params.orderType === 'market' 
          ? { limit: { tif: 'Ioc' } }
          : { limit: { tif: params.timeInForce || 'Gtc' } },
        ...(params.cloid && { c: params.cloid as `0x${string}` })
      } as any;
      
      logger.info(`Placing order: ${JSON.stringify(order)} (original price: ${params.price}, formatted: ${formattedPrice})`);
      
      const result = await exchangeClient.order({
        orders: [order],
        grouping: 'na' as const
      });
      
      return result;
    } catch (error) {
      logger.error('Error placing order:', error);
      throw error;
    }
  }

  async cancelOrder(agentId: string, params: {
    asset: number;
    orderId: number;
  }): Promise<any> {
    try {
      const agent = await this.agentRepository.getApproved(agentId);
      
      if (!agent) {
        throw new Error('Approved agent not found');
      }
      
      const privateKey = agent.private_key_encrypted as string;
      
      const exchangeClient = new hl.ExchangeClient({
        wallet: new ethers.Wallet(privateKey),
        transport: this.transport,
        isTestnet: this.useTestnet
      });
      
      const result = await exchangeClient.cancel({
        cancels: [{
          a: params.asset,
          o: params.orderId
        }]
      });
      
      logger.info(`Canceled order: asset=${params.asset}, orderId=${params.orderId}`);
      return result;
    } catch (error) {
      logger.error('Error canceling order:', error);
      throw error;
    }
  }

  async cancelOrderByCloid(agentId: string, params: {
    asset: number;
    cloid: string;
  }): Promise<any> {
    try {
      const agent = await this.agentRepository.getApproved(agentId);
      
      if (!agent) {
        throw new Error('Approved agent not found');
      }
      
      const privateKey = agent.private_key_encrypted as string;
      
      const exchangeClient = new hl.ExchangeClient({
        wallet: new ethers.Wallet(privateKey),
        transport: this.transport,
        isTestnet: this.useTestnet
      });
      
      const result = await exchangeClient.cancelByCloid({
        cancels: [{
          asset: params.asset,
          cloid: params.cloid as `0x${string}`
        }]
      });
      
      logger.info(`Canceled order by cloid: asset=${params.asset}, cloid=${params.cloid}`);
      return result;
    } catch (error) {
      logger.error('Error canceling order by cloid:', error);
      throw error;
    }
  }
}