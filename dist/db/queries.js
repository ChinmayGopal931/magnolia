"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserQueries = exports.PositionQueries = exports.AgentQueries = void 0;
const database_1 = require("../config/database");
exports.AgentQueries = {
    // Get agent DEX type by ID
    getAgentDexById: async (agentId) => {
        return await (0, database_1.query)(`
      SELECT dex FROM agents WHERE id = $1
    `, [agentId]);
    },
    // Get all agents for a user
    getAgentsByUserId: async (userId) => {
        console.log("test fetch all agents, ", (await (0, database_1.query)(`
      SELECT * FROM agents`)).rows);
        return await (0, database_1.query)(`
      SELECT * FROM agents 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);
    },
    // Get agent by ID
    getAgentById: async (agentId) => {
        return await (0, database_1.query)(`
      SELECT * FROM agents WHERE id = $1
    `, [agentId]);
    },
    // Create new agent
    createAgent: async (userId, dex, address, status = 'pending_approval') => {
        return await (0, database_1.query)(`
      INSERT INTO agents (user_id, dex, address, status)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [userId, dex, address, status]);
    },
    // Update agent private key
    updateAgentPrivateKey: async (agentId, privateKeyEncrypted) => {
        return await (0, database_1.query)(`
      UPDATE agents 
      SET private_key_encrypted = $1 
      WHERE id = $2
    `, [privateKeyEncrypted, agentId]);
    },
    // Get agent with user details for approval
    getAgentWithUserForApproval: async (agentId) => {
        return await (0, database_1.query)(`
      SELECT a.*, u.id as user_id, u.email
      FROM agents a
      JOIN users u ON a.user_id = u.id
      WHERE a.id = $1 AND a.status = 'pending_approval'
    `, [agentId]);
    },
    // Approve agent
    approveAgent: async (agentId) => {
        return await (0, database_1.query)(`
      UPDATE agents 
      SET status = 'approved', approved_at = NOW()
      WHERE id = $1
    `, [agentId]);
    },
    // Get approved agent details
    getApprovedAgent: async (agentId) => {
        return await (0, database_1.query)(`
      SELECT * FROM agents WHERE id = $1 AND status = 'approved'
    `, [agentId]);
    },
    // Get agent by wallet address
    getAgentByAddress: async (address) => {
        return await (0, database_1.query)(`
      SELECT * FROM agents WHERE address = $1
    `, [address]);
    },
    // Get agent by user ID and DEX
    getAgentByUserIdAndDex: async (userId, dex) => {
        return await (0, database_1.query)(`
      SELECT * FROM agents 
      WHERE user_id = $1 AND dex = $2
    `, [userId, dex]);
    },
    // Update agent address
    updateAgentAddress: async (agentId, address) => {
        return await (0, database_1.query)(`
      UPDATE agents 
      SET address = $1 
      WHERE id = $2
    `, [address, agentId]);
    }
};
exports.PositionQueries = {
    // Create new position
    createPosition: async (userId, agentId, dex, coin, side, size, leverage) => {
        return await (0, database_1.query)(`
      INSERT INTO positions (user_id, agent_id, dex, coin, side, size, leverage, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
    `, [userId, agentId, dex, coin, side, size, leverage || 1]);
    },
    // Get position with agent private key for closing
    getPositionWithAgentKey: async (positionId) => {
        return await (0, database_1.query)(`
      SELECT p.*, a.private_key_encrypted 
      FROM positions p
      JOIN agents a ON p.agent_id = a.id
      WHERE p.id = $1 AND p.status = 'open'
    `, [positionId]);
    },
    // Close position
    closePosition: async (positionId) => {
        return await (0, database_1.query)(`
      UPDATE positions 
      SET status = 'closed', closed_at = NOW()
      WHERE id = $1
    `, [positionId]);
    },
    // Get user's open positions with agent addresses
    getUserOpenPositions: async (userId) => {
        return await (0, database_1.query)(`
      SELECT p.*, a.address as agent_address
      FROM positions p
      JOIN agents a ON p.agent_id = a.id
      WHERE p.user_id = $1 AND p.status = 'open'
    `, [userId]);
    }
};
exports.UserQueries = {
    // Get user by ID
    getUserById: async (userId) => {
        console.log((await (0, database_1.query)(`select * from agents`)).rows);
        return await (0, database_1.query)(`
      SELECT * FROM users WHERE id = $1
    `, [userId]);
    },
    // Get user by email
    getUserByEmail: async (email) => {
        return await (0, database_1.query)(`
      SELECT * FROM users WHERE email = $1
    `, [email]);
    },
    // Create new user
    createUser: async (email, telegramId) => {
        return await (0, database_1.query)(`
      INSERT INTO users (email, telegram_id)
      VALUES ($1, $2)
      RETURNING id
    `, [email, telegramId]);
    }
};
//# sourceMappingURL=queries.js.map