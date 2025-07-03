import { HyperliquidService } from './hyperliquid/HyperliquidService';
import { AgentRepository, UserRepository } from '../db/repositories';
import { AgentWallet } from '../types';
import { HyperliquidAPI } from '../utils/hyperliquid-api';

export class AgentManager {
  private hyperliquidService: HyperliquidService;
  private agentRepository: AgentRepository;
  private userRepository: UserRepository;
  private useTestnet: boolean;
  
  constructor() {
    this.useTestnet = process.env.HYPERLIQUID_TESTNET === 'true';
    this.hyperliquidService = new HyperliquidService(this.useTestnet);
    this.agentRepository = new AgentRepository();
    this.userRepository = new UserRepository();
  }
  
  async createAgent(userId: string, dex: string): Promise<AgentWallet> {
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
      await this.agentRepository.approve(agentId);
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
  
  async getUserAgents(userId: string): Promise<AgentWallet[]> {
    return await this.agentRepository.getByUserId(userId);
  }
  
  async getAgentById(agentId: string): Promise<AgentWallet | null> {
    return await this.agentRepository.getById(agentId);
  }
}