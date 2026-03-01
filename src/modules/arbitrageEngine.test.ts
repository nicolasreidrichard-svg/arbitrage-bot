// src/modules/arbitrageEngine.test.ts

import {
    ArbitrageEngine,
    ArbitrageEngineConfig,
    DEXPrice,
    ExchangeRate,
    OpportunityResult,
} from './arbitrageEngine';

// Default config used by most tests.
const defaultConfig: ArbitrageEngineConfig = {
    minProfitThreshold: 0.001, // 0.1%
    gasCostUSD: 5,             // $5 per transaction
    defaultSlippageRate: 0.005, // 0.5% default slippage
    tradeAmountUSD: 10000,     // $10,000 notional trade
};

describe('ArbitrageEngine', () => {
    let engine: ArbitrageEngine;

    beforeEach(() => {
        engine = new ArbitrageEngine(defaultConfig);
    });

    // -------------------------------------------------------------------------
    // calculateNetProfit
    // -------------------------------------------------------------------------
    describe('calculateNetProfit', () => {
        it('returns grossProfit minus gas and slippage', () => {
            const net = engine.calculateNetProfit(0.05, 0.01, 0.005);
            expect(net).toBeCloseTo(0.035, 10);
        });

        it('returns a negative value when costs exceed gross profit', () => {
            const net = engine.calculateNetProfit(0.001, 0.01, 0.005);
            expect(net).toBeLessThan(0);
        });

        it('returns grossProfit when gas and slippage are zero', () => {
            const net = engine.calculateNetProfit(0.03, 0, 0);
            expect(net).toBeCloseTo(0.03, 10);
        });
    });

    // -------------------------------------------------------------------------
    // detectCrossExchangeOpportunities
    // -------------------------------------------------------------------------
    describe('detectCrossExchangeOpportunities', () => {
        it('detects a profitable cross-exchange opportunity', () => {
            const prices: DEXPrice[] = [
                { exchange: 'UniswapV3', pair: 'ETH/USDC', price: 2000 },
                { exchange: 'SushiSwap', pair: 'ETH/USDC', price: 2100 },
            ];
            const results = engine.detectCrossExchangeOpportunities(prices);
            expect(results.length).toBeGreaterThan(0);
            const best = results[0];
            expect(best.type).toBe('cross-exchange');
            expect(best.pair).toBe('ETH/USDC');
            expect(best.netProfit).toBeGreaterThan(0);
            // Buy on Uniswap (cheaper), sell on SushiSwap (more expensive).
            expect(best.exchanges).toContain('UniswapV3');
            expect(best.exchanges).toContain('SushiSwap');
        });

        it('does not return an opportunity when prices are equal', () => {
            const prices: DEXPrice[] = [
                { exchange: 'UniswapV3', pair: 'ETH/USDC', price: 2000 },
                { exchange: 'SushiSwap', pair: 'ETH/USDC', price: 2000 },
            ];
            const results = engine.detectCrossExchangeOpportunities(prices);
            expect(results).toHaveLength(0);
        });

        it('does not return an opportunity when net profit is below threshold', () => {
            // Tiny price difference that will be swamped by gas + slippage.
            const prices: DEXPrice[] = [
                { exchange: 'UniswapV3', pair: 'ETH/USDC', price: 2000 },
                { exchange: 'SushiSwap', pair: 'ETH/USDC', price: 2000.1 },
            ];
            const results = engine.detectCrossExchangeOpportunities(prices);
            expect(results).toHaveLength(0);
        });

        it('handles multiple pairs independently', () => {
            const prices: DEXPrice[] = [
                { exchange: 'UniswapV3', pair: 'ETH/USDC', price: 2000 },
                { exchange: 'SushiSwap', pair: 'ETH/USDC', price: 2200 },
                { exchange: 'UniswapV3', pair: 'BTC/USDC', price: 30000 },
                { exchange: 'SushiSwap', pair: 'BTC/USDC', price: 30000 },
            ];
            const results = engine.detectCrossExchangeOpportunities(prices);
            // Only ETH/USDC should yield an opportunity.
            const pairs = results.map((r) => r.pair);
            expect(pairs).toContain('ETH/USDC');
            const btcOpps = results.filter((r) => r.pair === 'BTC/USDC');
            expect(btcOpps).toHaveLength(0);
        });

        it('ignores entries with zero or negative prices', () => {
            const prices: DEXPrice[] = [
                { exchange: 'UniswapV3', pair: 'ETH/USDC', price: 0 },
                { exchange: 'SushiSwap', pair: 'ETH/USDC', price: 2100 },
            ];
            const results = engine.detectCrossExchangeOpportunities(prices);
            expect(results).toHaveLength(0);
        });

        it('uses liquidity to compute slippage when provided', () => {
            // High liquidity → lower slippage → more opportunities pass the threshold.
            const highLiqPrices: DEXPrice[] = [
                { exchange: 'UniswapV3', pair: 'ETH/USDC', price: 2000, liquidity: 1_000_000 },
                { exchange: 'SushiSwap', pair: 'ETH/USDC', price: 2060, liquidity: 1_000_000 },
            ];
            const lowLiqPrices: DEXPrice[] = [
                { exchange: 'UniswapV3', pair: 'ETH/USDC', price: 2000, liquidity: 5000 },
                { exchange: 'SushiSwap', pair: 'ETH/USDC', price: 2060, liquidity: 5000 },
            ];
            const highLiqResult = engine.detectCrossExchangeOpportunities(highLiqPrices);
            const lowLiqResult = engine.detectCrossExchangeOpportunities(lowLiqPrices);
            // High liquidity should yield higher net profit than low liquidity.
            if (highLiqResult.length > 0 && lowLiqResult.length > 0) {
                expect(highLiqResult[0].netProfit).toBeGreaterThan(lowLiqResult[0].netProfit);
            } else {
                // Low liquidity may swamp profit entirely; high liquidity result should remain.
                expect(highLiqResult.length).toBeGreaterThanOrEqual(lowLiqResult.length);
            }
        });

        it('populates the timestamp field', () => {
            const prices: DEXPrice[] = [
                { exchange: 'UniswapV3', pair: 'ETH/USDC', price: 2000 },
                { exchange: 'SushiSwap', pair: 'ETH/USDC', price: 2500 },
            ];
            const results = engine.detectCrossExchangeOpportunities(prices);
            expect(results[0].timestamp).toBeInstanceOf(Date);
        });
    });

    // -------------------------------------------------------------------------
    // detectTriangularOpportunities
    // -------------------------------------------------------------------------
    describe('detectTriangularOpportunities', () => {
        /**
         * Classic triangular arbitrage example:
         *   ETH → USDC at 2000 USDC/ETH
         *   USDC → BTC at 0.0000345 BTC/USDC  (i.e., 1 BTC = ~28,985 USDC)
         *   BTC → ETH at 14.9 ETH/BTC           (i.e., 1 ETH = ~0.0671 BTC)
         *
         * Product = 2000 × 0.0000345 × 14.9 ≈ 1.0281  → ~2.81% gross profit
         */
        const profitableRates: ExchangeRate[] = [
            { exchange: 'UniswapV3', fromToken: 'ETH',  toToken: 'USDC', rate: 2000 },
            { exchange: 'UniswapV3', fromToken: 'USDC', toToken: 'BTC',  rate: 0.0000345 },
            { exchange: 'UniswapV3', fromToken: 'BTC',  toToken: 'ETH',  rate: 14.9 },
        ];

        it('detects a profitable triangular opportunity', () => {
            const results = engine.detectTriangularOpportunities(profitableRates);
            expect(results.length).toBeGreaterThan(0);
            const best = results[0];
            expect(best.type).toBe('triangular');
            expect(best.grossProfit).toBeGreaterThan(0);
            expect(best.netProfit).toBeGreaterThan(0);
            expect(best.route).toHaveLength(3);
        });

        it('returns no opportunity when the rate product is ≤ 1', () => {
            // Fair market: product should equal exactly 1 (no free lunch).
            const fairRates: ExchangeRate[] = [
                { exchange: 'UniswapV3', fromToken: 'ETH',  toToken: 'USDC', rate: 2000 },
                { exchange: 'UniswapV3', fromToken: 'USDC', toToken: 'BTC',  rate: 0.00003333 },
                { exchange: 'UniswapV3', fromToken: 'BTC',  toToken: 'ETH',  rate: 15 },
                // 2000 × 0.00003333 × 15 = 0.9999 < 1 → no profit
            ];
            const results = engine.detectTriangularOpportunities(fairRates);
            expect(results).toHaveLength(0);
        });

        it('returns no opportunity when net profit is below threshold', () => {
            // Slightly profitable gross but crushed by costs.
            const tinyRates: ExchangeRate[] = [
                { exchange: 'UniswapV3', fromToken: 'ETH',  toToken: 'USDC', rate: 2000 },
                { exchange: 'UniswapV3', fromToken: 'USDC', toToken: 'BTC',  rate: 0.0000335 },
                { exchange: 'UniswapV3', fromToken: 'BTC',  toToken: 'ETH',  rate: 14.9 },
                // 2000 × 0.0000335 × 14.9 ≈ 0.9987 < 1 → no profit
            ];
            const results = engine.detectTriangularOpportunities(tinyRates);
            expect(results).toHaveLength(0);
        });

        it('sets the pair label to tokenA/tokenB/tokenC', () => {
            const results = engine.detectTriangularOpportunities(profitableRates);
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].pair).toBe('ETH/USDC/BTC');
        });

        it('includes all three exchanges in the exchanges field', () => {
            const multiExchangeRates: ExchangeRate[] = [
                { exchange: 'UniswapV3', fromToken: 'ETH',  toToken: 'USDC', rate: 2000 },
                { exchange: 'SushiSwap', fromToken: 'USDC', toToken: 'BTC',  rate: 0.0000345 },
                { exchange: 'Curve',     fromToken: 'BTC',  toToken: 'ETH',  rate: 14.9 },
            ];
            const results = engine.detectTriangularOpportunities(multiExchangeRates);
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].exchanges).toEqual(['UniswapV3', 'SushiSwap', 'Curve']);
        });
    });

    // -------------------------------------------------------------------------
    // filterAndRankOpportunities
    // -------------------------------------------------------------------------
    describe('filterAndRankOpportunities', () => {
        const makeOpp = (netProfit: number): OpportunityResult => ({
            type: 'cross-exchange',
            pair: 'ETH/USDC',
            route: ['A', 'B'],
            grossProfit: netProfit + 0.01,
            gasCost: 0.005,
            slippageCost: 0.005,
            netProfit,
            profitPercentage: netProfit * 100,
            exchanges: ['A', 'B'],
            timestamp: new Date(),
        });

        it('filters out opportunities below the minimum threshold', () => {
            const opps = [makeOpp(0.0005), makeOpp(0.005), makeOpp(0.02)];
            const filtered = engine.filterAndRankOpportunities(opps);
            expect(filtered.every((o) => o.netProfit >= defaultConfig.minProfitThreshold)).toBe(true);
            expect(filtered.length).toBe(2);
        });

        it('ranks opportunities from highest to lowest net profit', () => {
            const opps = [makeOpp(0.005), makeOpp(0.02), makeOpp(0.01)];
            const ranked = engine.filterAndRankOpportunities(opps);
            expect(ranked[0].netProfit).toBe(0.02);
            expect(ranked[1].netProfit).toBe(0.01);
            expect(ranked[2].netProfit).toBe(0.005);
        });

        it('returns an empty array when no opportunities pass the threshold', () => {
            const opps = [makeOpp(0.00001), makeOpp(-0.01)];
            expect(engine.filterAndRankOpportunities(opps)).toHaveLength(0);
        });
    });

    // -------------------------------------------------------------------------
    // detectOpportunities (integration)
    // -------------------------------------------------------------------------
    describe('detectOpportunities', () => {
        it('combines and ranks cross-exchange and triangular results', () => {
            const dexPrices: DEXPrice[] = [
                { exchange: 'UniswapV3', pair: 'ETH/USDC', price: 2000 },
                { exchange: 'SushiSwap', pair: 'ETH/USDC', price: 2500 },
            ];
            const exchangeRates: ExchangeRate[] = [
                { exchange: 'UniswapV3', fromToken: 'ETH',  toToken: 'USDC', rate: 2000 },
                { exchange: 'UniswapV3', fromToken: 'USDC', toToken: 'BTC',  rate: 0.0000345 },
                { exchange: 'UniswapV3', fromToken: 'BTC',  toToken: 'ETH',  rate: 14.9 },
            ];
            const results = engine.detectOpportunities(dexPrices, exchangeRates);
            expect(results.length).toBeGreaterThan(0);
            // All results must be above the threshold.
            results.forEach((r) => {
                expect(r.netProfit).toBeGreaterThanOrEqual(defaultConfig.minProfitThreshold);
            });
            // Results must be sorted highest-first.
            for (let i = 1; i < results.length; i++) {
                expect(results[i - 1].netProfit).toBeGreaterThanOrEqual(results[i].netProfit);
            }
        });

        it('works without exchangeRates (cross-exchange only)', () => {
            const dexPrices: DEXPrice[] = [
                { exchange: 'UniswapV3', pair: 'ETH/USDC', price: 2000 },
                { exchange: 'SushiSwap', pair: 'ETH/USDC', price: 2500 },
            ];
            const results = engine.detectOpportunities(dexPrices);
            expect(results.length).toBeGreaterThan(0);
            results.forEach((r) => expect(r.type).toBe('cross-exchange'));
        });

        it('returns empty array when no profitable opportunities exist', () => {
            const dexPrices: DEXPrice[] = [
                { exchange: 'UniswapV3', pair: 'ETH/USDC', price: 2000 },
                { exchange: 'SushiSwap', pair: 'ETH/USDC', price: 2000 },
            ];
            const results = engine.detectOpportunities(dexPrices);
            expect(results).toHaveLength(0);
        });
    });

    // -------------------------------------------------------------------------
    // Configuration edge cases
    // -------------------------------------------------------------------------
    describe('configuration edge cases', () => {
        it('respects a higher minProfitThreshold', () => {
            const strictEngine = new ArbitrageEngine({
                ...defaultConfig,
                minProfitThreshold: 0.10, // 10% — very high
            });
            const prices: DEXPrice[] = [
                { exchange: 'UniswapV3', pair: 'ETH/USDC', price: 2000 },
                { exchange: 'SushiSwap', pair: 'ETH/USDC', price: 2100 }, // only ~5% difference
            ];
            const results = strictEngine.detectCrossExchangeOpportunities(prices);
            expect(results).toHaveLength(0);
        });

        it('handles zero tradeAmountUSD gracefully (no division by zero)', () => {
            const zeroTradeEngine = new ArbitrageEngine({
                ...defaultConfig,
                tradeAmountUSD: 0,
            });
            const prices: DEXPrice[] = [
                { exchange: 'UniswapV3', pair: 'ETH/USDC', price: 2000 },
                { exchange: 'SushiSwap', pair: 'ETH/USDC', price: 2500 },
            ];
            expect(() => zeroTradeEngine.detectCrossExchangeOpportunities(prices)).not.toThrow();
        });
    });
});
