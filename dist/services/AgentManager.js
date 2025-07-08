"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentManager = void 0;
const HyperliquidService_1 = require("./hyperliquid/HyperliquidService");
const repositories_1 = require("../db/repositories");
const hyperliquid_api_1 = require("../utils/hyperliquid-api");
class AgentManager {
    hyperliquidService;
    agentRepository;
    userRepository;
    useTestnet;
    constructor() {
        this.useTestnet = process.env.HYPERLIQUID_TESTNET === 'true';
        this.hyperliquidService = new HyperliquidService_1.HyperliquidService(this.useTestnet);
        this.agentRepository = new repositories_1.AgentRepository();
        this.userRepository = new repositories_1.UserRepository();
    }
    async createAgent(userId, dex) {
        if (dex !== 'hyperliquid') {
            throw new Error(`DEX ${dex} not supported yet`);
        }
        // Validate that user exists
        const user = await this.userRepository.getById(userId);
        if (!user) {
            throw new Error(`User with ID ${userId} not found. Please create user first.`);
        }
        return await this.hyperliquidService.generateAgent(userId);
    }
    // Add this to your HyperliquidService class
    async approveAgent(agentId, signature, agentName, action // Add action parameter
    ) {
        try {
            // Get the agent details
            const agent = await this.agentRepository.getById(agentId);
            if (!agent) {
                throw new Error('Agent not found');
            }
            // Use the updated HyperliquidAPI.approveAgent method
            const result = await hyperliquid_api_1.HyperliquidAPI.approveAgent({
                agentAddress: agent.address,
                agentName: agentName,
                signature: signature,
                useTestnet: this.useTestnet,
                action: action // Pass the action parameter
            });
            // If successful, update the agent status using the existing approve method
            if (result.success) {
                await this.agentRepository.approve(agentId);
            }
            return result;
        }
        catch (error) {
            console.error('Error in HyperliquidService.approveAgent:', error);
            return {
                success: false,
                error: error.message || 'Failed to approve agent'
            };
        }
    }
    async getUserAgents(userId) {
        return await this.agentRepository.getByUserId(userId);
    }
    async getAgentById(agentId) {
        return await this.agentRepository.getById(agentId);
    }
}
exports.AgentManager = AgentManager;
//# sourceMappingURL=AgentManager.js.map