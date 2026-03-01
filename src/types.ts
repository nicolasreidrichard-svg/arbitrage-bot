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