import { UserQueries, DatabaseUser } from '../queries';

export class UserRepository {
  async getById(userId: string): Promise<DatabaseUser | null> {
    const result = await UserQueries.getUserById(userId);
    return result.rows[0] || null;
  }

  async getByEmail(email: string): Promise<DatabaseUser | null> {
    const result = await UserQueries.getUserByEmail(email);
    return result.rows[0] || null;
  }

  async create(email: string, telegramId?: string): Promise<string> {
    const result = await UserQueries.createUser(email, telegramId);
    return result.rows[0].id;
  }
}