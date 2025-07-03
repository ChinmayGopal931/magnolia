import { PositionQueries, DatabasePosition } from '../queries';

export class PositionRepository {
  async create(
    userId: string, 
    agentId: string, 
    dex: string, 
    coin: string, 
    side: 'long' | 'short', 
    size: string, 
    leverage?: number
  ): Promise<void> {
    await PositionQueries.createPosition(userId, agentId, dex, coin, side, size, leverage);
  }

  async getWithAgentKey(positionId: string): Promise<DatabasePosition & { private_key_encrypted: string } | null> {
    const result = await PositionQueries.getPositionWithAgentKey(positionId);
    return result.rows[0] || null;
  }

  async close(positionId: string): Promise<void> {
    await PositionQueries.closePosition(positionId);
  }

  async getUserOpenPositions(userId: string): Promise<Array<DatabasePosition & { agent_address: string }>> {
    const result = await PositionQueries.getUserOpenPositions(userId);
    return result.rows;
  }
}