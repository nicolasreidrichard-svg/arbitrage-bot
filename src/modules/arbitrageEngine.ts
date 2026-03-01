// src/modules/arbitrageEngine.ts

import Decimal from 'decimal.js';

// DEXPrice represents the price of a token pair on a specific DEX.
export interface DEXPrice {
    exchange: string; // Name of the DEX (e.g., Uniswap, SushiSwap)
    pair: string;     // Trading pair (e.g., ETH/USDC)
    price: number;    // Current price (how many quote tokens per base token)
    liquidity?: number; // Optional liquidity amount for slippage estimation
}

// ExchangeRate represents a conversion rate between two tokens on one exchange.
export interface ExchangeRate {
    exchange: string; // Name of the DEX
    fromToken: string; // Source token symbol
    toToken: string;   // Destination token symbol
    rate: number;      // Conversion rate (units of toToken per 1 fromToken)
    liquidity?: number; // Optional liquidity for slippage estimation
}

// OpportunityResult is the output of the arbitrage engine for a detected opportunity.
export interface OpportunityResult {
    type: 'cross-exchange' | 'triangular'; // Arbitrage type
    pair: string;                          // Primary trading pair involved
    route: string[];                       // Ordered list of exchanges/tokens in the trade route
    grossProfit: number;                   // Raw profit as a decimal fraction before costs (e.g., 0.02 = 2%)
    gasCost: number;                       // Estimated gas cost in quote-token units
    slippageCost: number;                  // Estimated slippage cost as a decimal fraction
    netProfit: number;                     // Profit after gas and slippage (decimal fraction)
    profitPercentage: number;              // Net profit expressed as a percentage
    exchanges: string[];                   // All exchanges involved
    timestamp: Date;                       // Detection timestamp
}

// ArbitrageEngineConfig holds the configurable parameters for the engine.
export interface ArbitrageEngineConfig {
    minProfitThreshold: number; // Minimum net profit fraction to report (e.g., 0.001 = 0.1%)
    gasCostUSD: number;         // Flat gas cost per transaction in USD (or quote-token equivalent)
    defaultSlippageRate: number; // Default slippage rate as a fraction (e.g., 0.005 = 0.5%)
    tradeAmountUSD: number;      // Notional trade size used to convert gas cost to a fraction
}

// ArbitrageEngine detects cross-exchange and triangular arbitrage opportunities.
export class ArbitrageEngine {
    private config: ArbitrageEngineConfig;

    constructor(config: ArbitrageEngineConfig) {
        this.config = config;
    }

    /**
     * Detect all profitable arbitrage opportunities from the provided market data.
     * Returns a list ranked from highest to lowest net profit.
     */
    public detectOpportunities(
        dexPrices: DEXPrice[],
        exchangeRates?: ExchangeRate[]
    ): OpportunityResult[] {
        const crossExchange = this.detectCrossExchangeOpportunities(dexPrices);
        const triangular = exchangeRates
            ? this.detectTriangularOpportunities(exchangeRates)
            : [];

        return this.filterAndRankOpportunities([...crossExchange, ...triangular]);
    }

    /**
     * Compare prices for the same trading pair across multiple exchanges.
     * An opportunity exists when buying on a cheaper exchange and selling on a
     * more expensive one yields a net profit above the minimum threshold.
     */
    public detectCrossExchangeOpportunities(dexPrices: DEXPrice[]): OpportunityResult[] {
        const opportunities: OpportunityResult[] = [];

        // Group prices by trading pair.
        const byPair: Record<string, DEXPrice[]> = {};
        for (const dp of dexPrices) {
            if (!byPair[dp.pair]) {
                byPair[dp.pair] = [];
            }
            byPair[dp.pair].push(dp);
        }

        for (const pair of Object.keys(byPair)) {
            const entries = byPair[pair];
            if (entries.length < 2) continue;

            for (let i = 0; i < entries.length; i++) {
                for (let j = 0; j < entries.length; j++) {
                    if (i === j) continue;

                    const buyExchange = entries[i];
                    const sellExchange = entries[j];

                    if (buyExchange.price <= 0 || sellExchange.price <= 0) continue;

                    // grossProfit as a fraction: (sellPrice - buyPrice) / buyPrice
                    const buyPrice = new Decimal(buyExchange.price);
                    const sellPrice = new Decimal(sellExchange.price);
                    const grossProfit = sellPrice.minus(buyPrice).div(buyPrice).toNumber();

                    if (grossProfit <= 0) continue;

                    const slippageCost = this.estimateSlippage(buyExchange) +
                        this.estimateSlippage(sellExchange);
                    const gasCost = this.gasAsFraction();
                    const netProfit = this.calculateNetProfit(grossProfit, gasCost, slippageCost);

                    if (netProfit < this.config.minProfitThreshold) continue;

                    opportunities.push({
                        type: 'cross-exchange',
                        pair,
                        route: [buyExchange.exchange, sellExchange.exchange],
                        grossProfit,
                        gasCost,
                        slippageCost,
                        netProfit,
                        profitPercentage: new Decimal(netProfit).mul(100).toNumber(),
                        exchanges: [buyExchange.exchange, sellExchange.exchange],
                        timestamp: new Date(),
                    });
                }
            }
        }

        return opportunities;
    }

    /**
     * Detect triangular arbitrage opportunities by cycling through three exchange
     * rates and checking whether the product of the rates exceeds 1 (i.e., the
     * round-trip yields more tokens than we started with).
     *
     * Each ExchangeRate entry describes the rate of converting fromToken → toToken
     * on a specific exchange.
     */
    public detectTriangularOpportunities(exchangeRates: ExchangeRate[]): OpportunityResult[] {
        const opportunities: OpportunityResult[] = [];
        const n = exchangeRates.length;

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (j === i) continue;
                // Leg B must start where leg A ended.
                if (exchangeRates[j].fromToken !== exchangeRates[i].toToken) continue;

                for (let k = 0; k < n; k++) {
                    if (k === i || k === j) continue;
                    // Leg C must start where leg B ended and return to leg A's start.
                    if (exchangeRates[k].fromToken !== exchangeRates[j].toToken) continue;
                    if (exchangeRates[k].toToken !== exchangeRates[i].fromToken) continue;

                    const rateA = new Decimal(exchangeRates[i].rate);
                    const rateB = new Decimal(exchangeRates[j].rate);
                    const rateC = new Decimal(exchangeRates[k].rate);

                    if (rateA.lte(0) || rateB.lte(0) || rateC.lte(0)) continue;

                    const product = rateA.mul(rateB).mul(rateC);
                    if (product.lte(1)) continue;

                    const grossProfit = product.minus(1).toNumber();

                    const slippageCost =
                        this.estimateSlippage(exchangeRates[i]) +
                        this.estimateSlippage(exchangeRates[j]) +
                        this.estimateSlippage(exchangeRates[k]);

                    // Three legs → two additional transactions compared to a direct swap.
                    const gasCost = this.gasAsFraction(3);
                    const netProfit = this.calculateNetProfit(grossProfit, gasCost, slippageCost);

                    if (netProfit < this.config.minProfitThreshold) continue;

                    const pairLabel = `${exchangeRates[i].fromToken}/${exchangeRates[i].toToken}/${exchangeRates[j].toToken}`;
                    const involvedExchanges = [
                        exchangeRates[i].exchange,
                        exchangeRates[j].exchange,
                        exchangeRates[k].exchange,
                    ];

                    opportunities.push({
                        type: 'triangular',
                        pair: pairLabel,
                        route: [
                            `${exchangeRates[i].fromToken}→${exchangeRates[i].toToken} (${exchangeRates[i].exchange})`,
                            `${exchangeRates[j].fromToken}→${exchangeRates[j].toToken} (${exchangeRates[j].exchange})`,
                            `${exchangeRates[k].fromToken}→${exchangeRates[k].toToken} (${exchangeRates[k].exchange})`,
                        ],
                        grossProfit,
                        gasCost,
                        slippageCost,
                        netProfit,
                        profitPercentage: new Decimal(netProfit).mul(100).toNumber(),
                        exchanges: involvedExchanges,
                        timestamp: new Date(),
                    });
                }
            }
        }

        return opportunities;
    }

    /**
     * Filter opportunities below the minimum profit threshold and rank the
     * remaining ones from highest to lowest net profit.
     */
    public filterAndRankOpportunities(opportunities: OpportunityResult[]): OpportunityResult[] {
        return opportunities
            .filter((o) => o.netProfit >= this.config.minProfitThreshold)
            .sort((a, b) => b.netProfit - a.netProfit);
    }

    /**
     * Calculate net profit after subtracting gas and slippage costs.
     * All values are expressed as decimal fractions of the trade amount.
     */
    public calculateNetProfit(
        grossProfit: number,
        gasCost: number,
        slippageCost: number
    ): number {
        return new Decimal(grossProfit)
            .minus(gasCost)
            .minus(slippageCost)
            .toNumber();
    }

    /**
     * Estimate slippage cost as a fraction of the trade amount.
     * Uses the liquidity field when available; otherwise falls back to the
     * configured default slippage rate.
     */
    private estimateSlippage(entry: { liquidity?: number }): number {
        if (entry.liquidity && entry.liquidity > 0 && this.config.tradeAmountUSD > 0) {
            // Simple price-impact model: slippage ≈ tradeSize / (2 * liquidity)
            return new Decimal(this.config.tradeAmountUSD)
                .div(new Decimal(2).mul(entry.liquidity))
                .toNumber();
        }
        return this.config.defaultSlippageRate;
    }

    /**
     * Convert a flat gas cost (USD) to a fraction of the notional trade amount.
     * @param legs - Number of on-chain transactions (default 2 for cross-exchange).
     */
    private gasAsFraction(legs: number = 2): number {
        if (this.config.tradeAmountUSD <= 0) return 0;
        return new Decimal(this.config.gasCostUSD)
            .mul(legs)
            .div(this.config.tradeAmountUSD)
            .toNumber();
    }
}

export default ArbitrageEngine;
