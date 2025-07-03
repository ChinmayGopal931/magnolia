import { Router, Request, Response } from 'express';
import { HyperliquidService } from '../services/hyperliquid/HyperliquidService';

const router = Router();
const hyperliquidService = new HyperliquidService(
  process.env.HYPERLIQUID_TESTNET === 'true'
);

// Open position
router.post('/', async (req: Request, res: Response) => {
  try {
    const { agentId, coin, side, size, isMarket, price, leverage } = req.body;
    
    if (!agentId || !coin || !side || !size) {
      return res.status(400).json({ 
        error: 'agentId, coin, side, and size required' 
      });
    }
    
    const result = await hyperliquidService.openPosition(agentId, {
      coin,
      side,
      size,
      isMarket: isMarket || true,
      price,
      leverage,
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's positions
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const positions = await hyperliquidService.getPositions(req.params.userId);
    res.json(positions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Close position
router.post('/:positionId/close', async (req: Request, res: Response) => {
  try {
    const result = await hyperliquidService.closePosition(req.params.positionId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get market data
router.get('/market/:coin', async (req: Request, res: Response) => {
  try {
    const marketData = await hyperliquidService.getMarketData(req.params.coin);
    res.json(marketData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;