import { query } from '../config/database';

export interface DatabaseAgent {
  id: string;
  user_id: string;
  dex: string;
  address: string;
  private_key_encrypted?: string;
  status: string;
  approved_at?: Date;
  created_at: Date;
}

export interface DatabasePosition {
  id: string;
  user_id: string;
  agent_id: string;
  dex: string;
  coin: string;
  side: 'long' | 'short';
  size: string;
  entry_price?: string;
  leverage?: number;
  stop_loss_price?: string;
  status: string;
  opened_at: Date;
  closed_at?: Date;
}

export interface DatabaseUser {
  id: string;
  email: string;
  telegram_id?: string;
  created_at: Date;
}

export const AgentQueries = {
  // Get agent DEX type by ID
  getAgentDexById: async (agentId: string) => {
    return await query(`
      SELECT dex FROM agents WHERE id = $1
    `, [agentId]);
  },

  // Get all agents for a user
  getAgentsByUserId: async (userId: string) => {
    console.log("test fetch all agents, ", (await query(`
      SELECT * FROM agents`)).rows);
    return await query(`
      SELECT * FROM agents 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);
  },

  // Get agent by ID
  getAgentById: async (agentId: string) => {
    return await query(`
      SELECT * FROM agents WHERE id = $1
    `, [agentId]);
  },

  // Create new agent
  createAgent: async (userId: string, dex: string, address: string, status: string = 'pending_approval') => {
    return await query(`
      INSERT INTO agents (user_id, dex, address, status)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [userId, dex, address, status]);
  },

  // Update agent private key
  updateAgentPrivateKey: async (agentId: string, privateKeyEncrypted: string) => {
    return await query(`
      UPDATE agents 
      SET private_key_encrypted = $1 
      WHERE id = $2
    `, [privateKeyEncrypted, agentId]);
  },

  // Get agent with user details for approval
  getAgentWithUserForApproval: async (agentId: string) => {
    return await query(`
      SELECT a.*, u.id as user_id, u.email
      FROM agents a
      JOIN users u ON a.user_id = u.id
      WHERE a.id = $1 AND a.status = 'pending_approval'
    `, [agentId]);
  },

  // Approve agent
  approveAgent: async (agentId: string) => {
    return await query(`
      UPDATE agents 
      SET status = 'approved', approved_at = NOW()
      WHERE id = $1
    `, [agentId]);
  },

  // Get approved agent details
  getApprovedAgent: async (agentId: string) => {
    return await query(`
      SELECT * FROM agents WHERE id = $1 AND status = 'approved'
    `, [agentId]);
  },

  // Get agent by wallet address
  getAgentByAddress: async (address: string) => {
    return await query(`
      SELECT * FROM agents WHERE address = $1
    `, [address]);
  },

  // Get agent by user ID and DEX
  getAgentByUserIdAndDex: async (userId: string, dex: string) => {
    return await query(`
      SELECT * FROM agents 
      WHERE user_id = $1 AND dex = $2
    `, [userId, dex]);
  },

  // Update agent address
  updateAgentAddress: async (agentId: string, address: string) => {
    return await query(`
      UPDATE agents 
      SET address = $1 
      WHERE id = $2
    `, [address, agentId]);
  }
};

export const PositionQueries = {
  // Create new position
  createPosition: async (userId: string, agentId: string, dex: string, coin: string, side: 'long' | 'short', size: string, leverage?: number) => {
    return await query(`
      INSERT INTO positions (user_id, agent_id, dex, coin, side, size, leverage, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
    `, [userId, agentId, dex, coin, side, size, leverage || 1]);
  },

  // Get position with agent private key for closing
  getPositionWithAgentKey: async (positionId: string) => {
    return await query(`
      SELECT p.*, a.private_key_encrypted 
      FROM positions p
      JOIN agents a ON p.agent_id = a.id
      WHERE p.id = $1 AND p.status = 'open'
    `, [positionId]);
  },

  // Close position
  closePosition: async (positionId: string) => {
    return await query(`
      UPDATE positions 
      SET status = 'closed', closed_at = NOW()
      WHERE id = $1
    `, [positionId]);
  },

  // Get user's open positions with agent addresses
  getUserOpenPositions: async (userId: string) => {
    return await query(`
      SELECT p.*, a.address as agent_address
      FROM positions p
      JOIN agents a ON p.agent_id = a.id
      WHERE p.user_id = $1 AND p.status = 'open'
    `, [userId]);
  }
};

export const UserQueries = {
  // Get user by ID
  getUserById: async (userId: string) => {
    console.log((await query(`select * from agents`)).rows);
    return await query(`
      SELECT * FROM users WHERE id = $1
    `, [userId]);
  },

  // Get user by email
  getUserByEmail: async (email: string) => {
    return await query(`
      SELECT * FROM users WHERE email = $1
    `, [email]);
  },

  // Create new user
  createUser: async (email: string, telegramId?: string) => {
    return await query(`
      INSERT INTO users (email, telegram_id)
      VALUES ($1, $2)
      RETURNING id
    `, [email, telegramId]);
  }
};