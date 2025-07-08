"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AgentManager_1 = require("../services/AgentManager");
const router = (0, express_1.Router)();
const agentManager = new AgentManager_1.AgentManager();
// Create new agent wallet
router.post('/', async (req, res) => {
    try {
        const { userId, dex } = req.body;
        if (!userId || !dex) {
            return res.status(400).json({
                error: 'userId and dex are required'
            });
        }
        const agent = await agentManager.createAgent(userId, dex);
        res.json(agent);
    }
    catch (error) {
        console.error('Error creating agent:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get user's agents
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({
                error: 'userId is required'
            });
        }
        const agents = await agentManager.getUserAgents(userId);
        res.json(agents);
    }
    catch (error) {
        console.error('Error getting user agents:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get specific agent by ID
router.get('/agent/:agentId', async (req, res) => {
    try {
        const { agentId } = req.params;
        if (!agentId) {
            return res.status(400).json({
                error: 'agentId is required'
            });
        }
        const agent = await agentManager.getAgentById(agentId);
        if (!agent) {
            return res.status(404).json({
                error: 'Agent not found'
            });
        }
        res.json(agent);
    }
    catch (error) {
        console.error('Error getting agent:', error);
        res.status(500).json({ error: error.message });
    }
});
// Approve agent (called after frontend gets signature)
router.post('/:agentId/approve', async (req, res) => {
    try {
        const { agentId } = req.params;
        const { signature, agentName, action } = req.body; // Accept action from frontend
        // Validate required parameters
        if (!agentId) {
            return res.status(400).json({
                error: 'agentId is required'
            });
        }
        if (!signature) {
            return res.status(400).json({
                error: 'signature is required'
            });
        }
        console.log(`Received approval request for agent ${agentId}`);
        console.log('Raw request body:', req.body);
        console.log('Signature type:', typeof signature);
        console.log('Signature value:', signature);
        console.log('Action type:', typeof action);
        console.log('Action value:', action);
        // Use the existing AgentManager approveAgent method
        // Pass the action from frontend
        const result = await agentManager.approveAgent(agentId, signature, agentName, action);
        if (result.success) {
            res.json({
                success: true,
                message: 'Agent approved successfully'
            });
        }
        else {
            // Handle specific error cases
            if (result.needsDeposit) {
                return res.status(400).json({
                    success: false,
                    needsDeposit: true,
                    error: result.error || 'Deposit required before approval'
                });
            }
            return res.status(400).json({
                success: false,
                error: result.error || 'Failed to approve agent'
            });
        }
    }
    catch (error) {
        console.error('Error approving agent:', error);
        // Check if it's a known error type
        if (error.message?.includes('Agent not found')) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }
        if (error.message?.includes('not supported')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=agents.js.map