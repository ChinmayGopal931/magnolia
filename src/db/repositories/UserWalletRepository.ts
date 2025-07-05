import { Pool } from 'pg';

export class UserWalletRepository {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  /**
   * Create a new user wallet
   */
  async create(
    userId: string,
    walletAddress: string,
    dex: string,
    isPrimary: boolean = false
  ): Promise<string> {
    const query = `
      INSERT INTO user_wallets (user_id, wallet_address, dex, is_primary)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    
    const result = await this.pool.query(query, [userId, walletAddress, dex, isPrimary]);
    return result.rows[0].id;
  }

  /**
   * Get user wallet by ID
   */
  async getById(id: string): Promise<UserWallet | null> {
    const query = `
      SELECT id, user_id, wallet_address, dex, is_primary, created_at, updated_at
      FROM user_wallets
      WHERE id = $1
    `;
    
    const result = await this.pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      walletAddress: row.wallet_address,
      dex: row.dex,
      isPrimary: row.is_primary,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get user wallet by wallet address
   */
  async getByWalletAddress(walletAddress: string): Promise<UserWallet | null> {
    const query = `
      SELECT id, user_id, wallet_address, dex, is_primary, created_at, updated_at
      FROM user_wallets
      WHERE wallet_address = $1
    `;
    
    const result = await this.pool.query(query, [walletAddress]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      walletAddress: row.wallet_address,
      dex: row.dex,
      isPrimary: row.is_primary,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get all wallets for a user
   */
  async getByUserId(userId: string): Promise<UserWallet[]> {
    const query = `
      SELECT id, user_id, wallet_address, dex, is_primary, created_at, updated_at
      FROM user_wallets
      WHERE user_id = $1
      ORDER BY is_primary DESC, created_at DESC
    `;
    
    const result = await this.pool.query(query, [userId]);
    
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      walletAddress: row.wallet_address,
      dex: row.dex,
      isPrimary: row.is_primary,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Get wallets for a user by DEX
   */
  async getByUserIdAndDex(userId: string, dex: string): Promise<UserWallet[]> {
    const query = `
      SELECT id, user_id, wallet_address, dex, is_primary, created_at, updated_at
      FROM user_wallets
      WHERE user_id = $1 AND dex = $2
      ORDER BY is_primary DESC, created_at DESC
    `;
    
    const result = await this.pool.query(query, [userId, dex]);
    
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      walletAddress: row.wallet_address,
      dex: row.dex,
      isPrimary: row.is_primary,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Get primary wallet for a user and DEX
   */
  async getPrimaryWallet(userId: string, dex: string): Promise<UserWallet | null> {
    const query = `
      SELECT id, user_id, wallet_address, dex, is_primary, created_at, updated_at
      FROM user_wallets
      WHERE user_id = $1 AND dex = $2 AND is_primary = true
      LIMIT 1
    `;
    
    const result = await this.pool.query(query, [userId, dex]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      walletAddress: row.wallet_address,
      dex: row.dex,
      isPrimary: row.is_primary,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Update primary wallet for a user and DEX
   */
  async setPrimaryWallet(userId: string, walletAddress: string, dex: string): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Set all wallets for this user/dex as non-primary
      await client.query(
        'UPDATE user_wallets SET is_primary = false WHERE user_id = $1 AND dex = $2',
        [userId, dex]
      );
      
      // Set the specified wallet as primary
      const result = await client.query(
        'UPDATE user_wallets SET is_primary = true WHERE user_id = $1 AND wallet_address = $2 AND dex = $3',
        [userId, walletAddress, dex]
      );
      
      await client.query('COMMIT');
      
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if wallet exists for user
   */
  async walletExists(userId: string, walletAddress: string, dex: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM user_wallets
      WHERE user_id = $1 AND wallet_address = $2 AND dex = $3
      LIMIT 1
    `;
    
    const result = await this.pool.query(query, [userId, walletAddress, dex]);
    return result.rows.length > 0;
  }

  /**
   * Delete a user wallet
   */
  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM user_wallets WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete wallet by address
   */
  async deleteByWalletAddress(walletAddress: string): Promise<boolean> {
    const query = 'DELETE FROM user_wallets WHERE wallet_address = $1';
    const result = await this.pool.query(query, [walletAddress]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Update wallet
   */
  async update(id: string, updates: Partial<UserWallet>): Promise<boolean> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.isPrimary !== undefined) {
      fields.push(`is_primary = $${paramIndex++}`);
      values.push(updates.isPrimary);
    }

    if (fields.length === 0) {
      return false;
    }

    values.push(id);
    const query = `
      UPDATE user_wallets 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
    `;

    const result = await this.pool.query(query, values);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get wallet count for user and dex
   */
  async getWalletCount(userId: string, dex: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM user_wallets
      WHERE user_id = $1 AND dex = $2
    `;
    
    const result = await this.pool.query(query, [userId, dex]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Validate user owns wallet
   */
  async validateUserOwnsWallet(userId: string, walletAddress: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM user_wallets
      WHERE user_id = $1 AND wallet_address = $2
      LIMIT 1
    `;
    
    const result = await this.pool.query(query, [userId, walletAddress]);
    return result.rows.length > 0;
  }

  /**
   * Create a new user with a wallet address
   */
  async createUserWithWallet(walletAddress: string, dex: string = 'drift'): Promise<{ userId: string; walletId: string }> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create user with wallet address as email (temporary solution)
      const userQuery = `
        INSERT INTO users (email)
        VALUES ($1)
        RETURNING id
      `;
      const userResult = await client.query(userQuery, [`${walletAddress}@wallet.local`]);
      const userId = userResult.rows[0].id;
      
      // Create wallet record
      const walletQuery = `
        INSERT INTO user_wallets (user_id, wallet_address, dex, is_primary)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `;
      const walletResult = await client.query(walletQuery, [userId, walletAddress, dex, true]);
      const walletId = walletResult.rows[0].id;
      
      await client.query('COMMIT');
      
      return { userId, walletId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get or create user by wallet address
   */
  async getOrCreateUserByWallet(walletAddress: string, dex: string = 'drift'): Promise<{ userId: string; walletId: string; isNew: boolean }> {
    // First try to find existing user
    const existingWallet = await this.getByWalletAddress(walletAddress);
    
    if (existingWallet) {
      return { 
        userId: existingWallet.userId, 
        walletId: existingWallet.id, 
        isNew: false 
      };
    }
    
    // Create new user and wallet
    const { userId, walletId } = await this.createUserWithWallet(walletAddress, dex);
    
    return { userId, walletId, isNew: true };
  }
}