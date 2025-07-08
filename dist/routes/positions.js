"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const HyperliquidService_1 = require("../services/hyperliquid/HyperliquidService");
const router = (0, express_1.Router)();
const hyperliquidService = new HyperliquidService_1.HyperliquidService(process.env.HYPERLIQUID_TESTNET === 'true');
// Open position
router.post('/', async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get user's positions
router.get('/user/:userId', async (req, res) => {
    try {
        const positions = await hyperliquidService.getPositions(req.params.userId);
        res.json(positions);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Close position
router.post('/:positionId/close', async (req, res) => {
    try {
        const result = await hyperliquidService.closePosition(req.params.positionId);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get market data
router.get('/market/:coin', async (req, res) => {
    try {
        const marketData = await hyperliquidService.getMarketData(req.params.coin);
        res.json(marketData);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Place direct order (new endpoint)
router.post('/order', async (req, res) => {
    try {
        const { agentId, asset, isBuy, price, size, reduceOnly = false, orderType = 'limit', timeInForce = 'Gtc' } = req.body;
        if (!agentId || asset === undefined || isBuy === undefined || !price || !size) {
            return res.status(400).json({
                error: 'agentId, asset, isBuy, price, and size are required'
            });
        }
        const result = await hyperliquidService.placeOrder(agentId, {
            asset,
            isBuy,
            price,
            size,
            reduceOnly,
            orderType,
            timeInForce
        });
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Cancel order (new endpoint)
router.post('/order/cancel', async (req, res) => {
    try {
        const { agentId, asset, orderId } = req.body;
        if (!agentId || asset === undefined || !orderId) {
            return res.status(400).json({
                error: 'agentId, asset, and orderId are required'
            });
        }
        const result = await hyperliquidService.cancelOrder(agentId, {
            asset,
            orderId
        });
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Cancel order by client order ID (new endpoint)
router.post('/order/cancel-by-cloid', async (req, res) => {
    try {
        const { agentId, asset, cloid } = req.body;
        if (!agentId || asset === undefined || !cloid) {
            return res.status(400).json({
                error: 'agentId, asset, and cloid are required'
            });
        }
        const result = await hyperliquidService.cancelOrderByCloid(agentId, {
            asset,
            cloid
        });
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=positions.js.map