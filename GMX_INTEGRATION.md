# GMX Integration for Magnolia

## Overview

This document provides an overview of the GMX protocol integration into the Magnolia DEX Position Management Service. The integration allows users to connect their wallets, authenticate with the backend, and manage trading positions on GMX.

## Architecture

The GMX integration follows a modular architecture with the following components:

1. **GMXService**: Core service for interacting with the GMX protocol
2. **GMX API Routes**: Express routes for exposing GMX functionality
3. **Authentication**: JWT-based authentication for wallet verification
4. **Wallet Connection**: Frontend UI for connecting user wallets

## Components

### GMXService (`src/services/gmx/GMXService.ts`)

The GMXService provides methods for interacting with the GMX protocol using the official GMX SDK. Key features include:

- Market data retrieval
- Position management (open, close)
- Order management
- Wallet integration

### GMX API Routes (`src/routes/gmx.ts`)

Express routes that expose GMX functionality to clients:

- `/api/gmx/markets`: Get all available markets
- `/api/gmx/markets/:marketAddress`: Get market info by address
- `/api/gmx/positions`: Get positions for authenticated user
- `/api/gmx/initialize`: Initialize GMX service with wallet
- `/api/gmx/positions/long`: Create a long position
- `/api/gmx/positions/short`: Create a short position
- `/api/gmx/positions/close`: Close a position
- `/api/gmx/orders/cancel`: Cancel an order

### Authentication (`src/routes/gmx-auth.ts`)

Handles wallet authentication using a nonce-based signature verification flow:

1. User requests a nonce
2. User signs the nonce with their wallet
3. Backend verifies the signature
4. Backend issues a JWT token for authenticated requests

Routes:
- `/api/gmx-auth/nonce`: Get a nonce for wallet signature
- `/api/gmx-auth/verify`: Verify wallet signature and get JWT token

### Wallet Connection (`public/wallet-connect.html`)

A simple frontend UI for connecting MetaMask wallets and authenticating with the backend.

## Database Changes

The following database changes were made to support GMX integration:

1. Added methods to `AgentRepository` for wallet address management:
   - `getByAddress`: Find agent by wallet address
   - `getByUserIdAndDex`: Find agent by user ID and DEX
   - `updateAddress`: Update agent's wallet address

2. Added corresponding SQL queries in `queries.ts`

## Configuration

GMX-specific configuration options in `config/index.ts`:

```typescript
gmx: {
  rpcUrl: process.env.GMX_RPC_URL || 'https://arb1.arbitrum.io/rpc',
  oracleUrl: process.env.GMX_ORACLE_URL || 'https://arbitrum-api.gmxinfra.io',
  subsquidUrl: process.env.GMX_SUBSQUID_URL || 'https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql',
  chainId: Number(process.env.GMX_CHAIN_ID || 42161) // Arbitrum One
},
jwt: {
  secret: process.env.JWT_SECRET || 'your-secret-key-here',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d'
}
```

## Testing

Tests for GMX integration are available in `src/tests/gmx-integration.test.ts`. Run them with:

```bash
npm run test:gmx
```

## Key Differences from Hyperliquid Integration

1. **Wallet Management**:
   - Hyperliquid: Backend creates and manages wallets for users
   - GMX: Users connect their own wallets (e.g., MetaMask)

2. **Authentication**:
   - Hyperliquid: API key-based authentication
   - GMX: Wallet signature-based authentication with JWT tokens

3. **Transaction Signing**:
   - Hyperliquid: Backend signs transactions
   - GMX: Users sign transactions through their connected wallets

## Usage Flow

1. User connects their wallet via the wallet connection UI
2. Backend authenticates the wallet and issues a JWT token
3. Frontend stores the JWT token for authenticated requests
4. User can now interact with GMX through the API endpoints

## Future Improvements

1. Enhanced error handling and validation
2. Support for additional wallet providers (WalletConnect, etc.)
3. More comprehensive testing
4. UI improvements for wallet connection
5. Position monitoring and notifications

## Dependencies

- `@gmx-io/sdk`: Official GMX SDK
- `viem`: Ethereum interaction library used by GMX SDK
- `jsonwebtoken`: JWT token generation and verification
- `winston`: Logging

## References

- [GMX SDK Documentation](https://github.com/gmx-io/gmx-interface/tree/master/sdk)
- [Arbitrum Documentation](https://developer.arbitrum.io/)
