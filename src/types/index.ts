// src/types/index.ts
export interface AgentWallet {
  id: string;
  address: string;
  dex: string;
  userId: string;
  isApproved: boolean;
  createdAt?: Date;
  approvedAt?: Date;
}

export interface Position {
  id?: string;
  userId: string;
  agentId: string;
  dex: string;
  coin: string;
  side: 'long' | 'short';
  size: string;
  entryPrice?: string;
  leverage: number;
  stopLossPrice?: string;
  status?: string;
  openedAt?: Date;
  closedAt?: Date;
  agentAddress?: string;
  // Real-time data from Hyperliquid
  currentPrice?: string;
  unrealizedPnl?: string;
  liquidationPrice?: string | null;
  marginUsed?: string;
}

export interface OrderParams {
  coin: string;
  side: 'buy' | 'sell';
  size: string;
  price?: string;
  isMarket: boolean;
  reduceOnly?: boolean;
  stopLoss?: string;
  leverage?: number;
}

export interface MarketData {
  coin: string;
  price: string;
  fundingRate: string;
  markPrice: string;
  openInterest: string;
}