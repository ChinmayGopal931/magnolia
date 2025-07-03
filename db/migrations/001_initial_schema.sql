-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  telegram_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agents table (stores agent wallets)
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  dex VARCHAR(50) NOT NULL,
  address VARCHAR(42) NOT NULL,
  private_key_encrypted TEXT,
  status VARCHAR(20) DEFAULT 'pending_approval',
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, dex)
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),
  dex VARCHAR(50) NOT NULL,
  coin VARCHAR(20) NOT NULL,
  side VARCHAR(5) CHECK (side IN ('long', 'short')),
  size DECIMAL(20, 8),
  entry_price DECIMAL(20, 8),
  leverage INTEGER,
  stop_loss_price DECIMAL(20, 8),
  status VARCHAR(20) DEFAULT 'open',
  opened_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP
);

-- Create indexes for positions
CREATE INDEX IF NOT EXISTS idx_user_status ON positions(user_id, status);

-- Position pairs for delta neutral
CREATE TABLE IF NOT EXISTS position_pairs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  long_position_id UUID REFERENCES positions(id),
  short_position_id UUID REFERENCES positions(id),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  position_id UUID REFERENCES positions(id),
  type VARCHAR(50),
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_alerts_user_unsent ON alerts(user_id, sent_at) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_positions_monitoring ON positions(status, stop_loss_price) WHERE status = 'open';