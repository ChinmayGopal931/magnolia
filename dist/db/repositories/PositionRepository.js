"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionRepository = void 0;
const queries_1 = require("../queries");
class PositionRepository {
    async create(userId, agentId, dex, coin, side, size, leverage) {
        await queries_1.PositionQueries.createPosition(userId, agentId, dex, coin, side, size, leverage);
    }
    async getWithAgentKey(positionId) {
        const result = await queries_1.PositionQueries.getPositionWithAgentKey(positionId);
        return result.rows[0] || null;
    }
    async close(positionId) {
        await queries_1.PositionQueries.closePosition(positionId);
    }
    async getUserOpenPositions(userId) {
        const result = await queries_1.PositionQueries.getUserOpenPositions(userId);
        return result.rows;
    }
}
exports.PositionRepository = PositionRepository;
//# sourceMappingURL=PositionRepository.js.map