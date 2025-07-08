# Magnolia

Magnolia is a DEX Position Management Service that supports multiple decentralized exchanges (DEXes).

## Supported DEXes

### Hyperliquid

Hyperliquid integration uses backend-managed wallets. The service creates and manages wallets for users.

### GMX

GMX integration uses user-controlled wallets. Users connect their own wallets (e.g., MetaMask) to interact with the GMX protocol.

## Setup

### Prerequisites

- Node.js (v16+)
- PostgreSQL
- Redis

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run migrations
npm run migrate

# Start the server
npm start
```

### Environment Variables

Create a `.env` file with the following variables:

```
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://username:password@localhost:5432/magnolia
REDIS_URL=redis://localhost:6379
HYPERLIQUID_TESTNET=true
MONITOR_INTERVAL_MINUTES=30

# GMX Configuration
GMX_RPC_URL=https://arb1.arbitrum.io/rpc
GMX_ORACLE_URL=https://arbitrum-api.gmxinfra.io
GMX_SUBSQUID_URL=https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql
GMX_CHAIN_ID=42161

# JWT for authentication
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d
```

## API Documentation

### Hyperliquid API

- `POST /api/agents` - Create a new agent
- `GET /api/agents` - Get all agents for a user
- `GET /api/positions` - Get all positions for a user
- `POST /api/positions` - Open a new position
- `PUT /api/positions/:id/close` - Close a position

### GMX API

#### Authentication

- `POST /api/gmx-auth/nonce` - Get a nonce for wallet signature
- `POST /api/gmx-auth/verify` - Verify wallet signature and get JWT token

#### Markets and Positions

- `GET /api/gmx/markets` - Get all available markets
- `GET /api/gmx/markets/:marketAddress` - Get market info by address
- `GET /api/gmx/positions` - Get all positions for authenticated user
- `POST /api/gmx/initialize` - Initialize GMX service with wallet
- `POST /api/gmx/positions/long` - Create a long position
- `POST /api/gmx/positions/short` - Create a short position
- `POST /api/gmx/positions/close` - Close a position
- `POST /api/gmx/orders/cancel` - Cancel an order

## Wallet Connection

For GMX integration, users need to connect their wallets. A simple wallet connection UI is available at `/wallet-connect.html`.
