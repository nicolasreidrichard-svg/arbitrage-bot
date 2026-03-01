// src/types.ts

// Price interface represents the price information for a cryptocurrency.
export interface Price {
    symbol: string; // The symbol of the cryptocurrency (e.g., ETH, BTC)
    value: number; // The current price value
    timestamp: Date; // The timestamp of when the price was obtained
}

// MarketData interface represents the data from a specific market.
export interface MarketData {
    exchange: string; // The name of the exchange (e.g., Binance, Coinbase)
    pair: string; // The trading pair (e.g., ETH/BTC)
    prices: Price[]; // An array of prices for the trading pair
}

// Opportunity interface represents a potential arbitrage opportunity.
export interface Opportunity {
    marketData: MarketData; // Market data linked to this opportunity
    profit: number; // The potential profit for this arbitrage opportunity
}

// TradeResult interface represents the result of a trade execution.
export interface TradeResult {
    success: boolean; // Indicates if the trade was successful
    message: string; // A message providing more information
    executedPrice: Price; // The price at which the trade was executed
}

// Wallet interface represents a user's cryptocurrency wallet.
export interface Wallet {
    address: string; // The wallet's address
    balance: { [symbol: string]: number }; // Balance for each cryptocurrency symbol
}

// GasEstimate interface represents an estimate of gas fees for transaction execution.
export interface GasEstimate {
    estimatedGas: number; // Estimated gas required for the transaction
    gasPrice: number; // Gas price per unit
}

// TransactionState represents the lifecycle state of a blockchain transaction.
export enum TransactionState {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    FAILED = 'failed',
    CANCELLED = 'cancelled',
}

// TransactionRecord tracks a submitted transaction and its current state.
export interface TransactionRecord {
    hash: string; // Transaction hash
    state: TransactionState; // Current state
    nonce: number; // Nonce used for this transaction
    timestamp: Date; // When the transaction was submitted
    opportunity?: Opportunity; // The arbitrage opportunity that triggered this trade
    gasUsed?: number; // Actual gas consumed (set on confirmation)
    error?: string; // Error message if the transaction failed
}

// SwapStep describes a single hop in a multi-hop DEX swap.
export interface SwapStep {
    dexRouter: string; // Address of the DEX router contract
    path: string[]; // Ordered token addresses for the swap path
    amountIn: string; // Input amount in wei (as decimal string)
    minAmountOut: string; // Minimum acceptable output amount in wei (slippage guard)
    deadline: number; // Unix timestamp after which the swap is invalid
}

// TradingExecutorConfig holds configuration for the TradingExecutor.
export interface TradingExecutorConfig {
    rpcUrl: string; // JSON-RPC endpoint URL
    privateKey: string; // Wallet private key (hex string)
    maxGasPriceGwei: number; // Maximum acceptable gas price in Gwei
    gasPriceMultiplier: number; // Multiplier applied to base gas price (e.g., 1.2)
    confirmationBlocks: number; // Number of blocks to wait for confirmation
    slippageTolerance: number; // Fractional slippage tolerance (e.g., 0.005 = 0.5%)
    transactionTimeoutMs: number; // Milliseconds to wait before timing out
}