-- Sample seed data for testing
-- This file contains sample users, agents, and positions for development and testing

-- Sample users
INSERT INTO users (id, email, telegram_id) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'alice@example.com', 'alice_tg'),
  ('550e8400-e29b-41d4-a716-446655440002', 'bob@example.com', 'bob_tg'),
  ('550e8400-e29b-41d4-a716-446655440003', 'charlie@example.com', NULL)
ON CONFLICT (email) DO NOTHING;

-- Sample agents
INSERT INTO agents (id, user_id, dex, address, status, approved_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440001', 'hyperliquid', '0x1234567890abcdef1234567890abcdef12345678', 'approved', NOW()),
  ('550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440002', 'hyperliquid', '0xabcdef1234567890abcdef1234567890abcdef12', 'pending_approval', NULL),
  ('550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440003', 'hyperliquid', '0x9876543210fedcba9876543210fedcba98765432', 'approved', NOW())
ON CONFLICT (user_id, dex) DO NOTHING;

-- Sample positions
INSERT INTO positions (id, user_id, agent_id, dex, coin, side, size, entry_price, leverage, stop_loss_price, status) VALUES
  ('550e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440011', 'hyperliquid', 'ETH', 'long', 10.5, 2500.00, 5, 2300.00, 'open'),
  ('550e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440011', 'hyperliquid', 'ETH', 'short', 10.5, 2500.00, 5, 2700.00, 'open'),
  ('550e8400-e29b-41d4-a716-446655440023', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440013', 'hyperliquid', 'BTC', 'long', 0.5, 45000.00, 3, 42000.00, 'open')
ON CONFLICT (id) DO NOTHING;

-- Sample position pair (delta neutral)
INSERT INTO position_pairs (id, user_id, long_position_id, short_position_id, status) VALUES
  ('550e8400-e29b-41d4-a716-446655440031', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440022', 'active')
ON CONFLICT (id) DO NOTHING;

-- Sample alerts
INSERT INTO alerts (id, user_id, position_id, type, message) VALUES
  ('550e8400-e29b-41d4-a716-446655440041', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440021', 'stop_loss_alert', 'ETH position approaching stop loss level'),
  ('550e8400-e29b-41d4-a716-446655440042', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440023', 'profit_alert', 'BTC position reached 10% profit target')
ON CONFLICT (id) DO NOTHING;