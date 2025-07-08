"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRepository = void 0;
const queries_1 = require("../queries");
class AgentRepository {
    async getDexById(agentId) {
        const result = await queries_1.AgentQueries.getAgentDexById(agentId);
        return result.rows[0]?.dex || null;
    }
    async getByUserId(userId) {
        const result = await queries_1.AgentQueries.getAgentsByUserId(userId);
        return result.rows.map(row => ({
            id: row.id,
            address: row.address,
            dex: row.dex,
            userId: row.user_id,
            isApproved: row.status === 'approved',
        }));
    }
    async getById(agentId) {
        const result = await queries_1.AgentQueries.getAgentById(agentId);
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
    async create(userId, dex, address, status = 'pending_approval') {
        const result = await queries_1.AgentQueries.createAgent(userId, dex, address, status);
        return result.rows[0].id;
    }
    async updatePrivateKey(agentId, privateKeyEncrypted) {
        await queries_1.AgentQueries.updateAgentPrivateKey(agentId, privateKeyEncrypted);
    }
    async getWithUserForApproval(agentId) {
        const result = await queries_1.AgentQueries.getAgentWithUserForApproval(agentId);
        return result.rows[0] || null;
    }
    async approve(agentId) {
        await queries_1.AgentQueries.approveAgent(agentId);
    }
    async getApproved(agentId) {
        const result = await queries_1.AgentQueries.getApprovedAgent(agentId);
        return result.rows[0] || null;
    }
    async getByAddress(address) {
        const result = await queries_1.AgentQueries.getAgentByAddress(address);
        return result.rows[0] || null;
    }
    async getByUserIdAndDex(userId, dex) {
        const result = await queries_1.AgentQueries.getAgentByUserIdAndDex(userId, dex);
        return result.rows[0] || null;
    }
    async updateAddress(agentId, address) {
        await queries_1.AgentQueries.updateAgentAddress(agentId, address);
    }
}
exports.AgentRepository = AgentRepository;
//# sourceMappingURL=AgentRepository.js.map