import { AgentQueries, DatabaseAgent } from '../queries';
import { AgentWallet } from '../../types';

export class AgentRepository {
  async getDexById(agentId: string): Promise<string | null> {
    const result = await AgentQueries.getAgentDexById(agentId);
    return result.rows[0]?.dex || null;
  }

  async getByUserId(userId: string): Promise<AgentWallet[]> {
    const result = await AgentQueries.getAgentsByUserId(userId);
    return result.rows.map(row => ({
      id: row.id,
      address: row.address,
      dex: row.dex,
      userId: row.user_id,
      isApproved: row.status === 'approved',
    }));
  }

  async getById(agentId: string): Promise<AgentWallet | null> {
    const result = await AgentQueries.getAgentById(agentId);
    if (!result.rows[0]) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      address: row.address,
      dex: row.dex,
      userId: row.user_id,
      isApproved: row.status === 'approved',
    };
  }

  async create(userId: string, dex: string, address: string, status: string = 'pending_approval'): Promise<string> {
    const result = await AgentQueries.createAgent(userId, dex, address, status);
    return result.rows[0].id;
  }

  async updatePrivateKey(agentId: string, privateKeyEncrypted: string): Promise<void> {
    await AgentQueries.updateAgentPrivateKey(agentId, privateKeyEncrypted);
  }

  async getWithUserForApproval(agentId: string): Promise<DatabaseAgent & { user_id: string; email: string } | null> {
    const result = await AgentQueries.getAgentWithUserForApproval(agentId);
    return result.rows[0] || null;
  }

  async approve(agentId: string): Promise<void> {
    await AgentQueries.approveAgent(agentId);
  }

  async getApproved(agentId: string): Promise<DatabaseAgent | null> {
    const result = await AgentQueries.getApprovedAgent(agentId);
    return result.rows[0] || null;
  }

  async getByAddress(address: string): Promise<DatabaseAgent | null> {
    const result = await AgentQueries.getAgentByAddress(address);
    return result.rows[0] || null;
  }

  async getByUserIdAndDex(userId: string, dex: string): Promise<DatabaseAgent | null> {
    const result = await AgentQueries.getAgentByUserIdAndDex(userId, dex);
    return result.rows[0] || null;
  }

  async updateAddress(agentId: string, address: string): Promise<void> {
    await AgentQueries.updateAgentAddress(agentId, address);
  }
}