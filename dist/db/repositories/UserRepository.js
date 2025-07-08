"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const queries_1 = require("../queries");
class UserRepository {
    async getById(userId) {
        const result = await queries_1.UserQueries.getUserById(userId);
        return result.rows[0] || null;
    }
    async getByEmail(email) {
        const result = await queries_1.UserQueries.getUserByEmail(email);
        return result.rows[0] || null;
    }
    async create(email, telegramId) {
        const result = await queries_1.UserQueries.createUser(email, telegramId);
        return result.rows[0].id;
    }
}
exports.UserRepository = UserRepository;
//# sourceMappingURL=UserRepository.js.map