// src/tests/arbitrageEngine.test.ts
// Unit tests for the Arbitrage Engine

import ArbitrageEngine from '../modules/arbitrageEngine';
import MarketDataFetcher from '../modules/marketDataFetcher';
import GasOptimizer from '../modules/gasOptimizer';

jest.mock('../modules/marketDataFetcher');
jest.mock('../modules/gasOptimizer');
jest.mock('../utils/logger', () => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const MockedFetcher = MarketDataFetcher as jest.MockedClass<typeof MarketDataFetcher>;
const MockedGasOptimizer = GasOptimizer as jest.MockedClass<typeof GasOptimizer>;

const makePrice = (exchange: string, bid: number, ask: number) => ({
    exchange,
    pair: 'ETHUSDT',
    bid,
    ask,
    mid: (bid + ask) / 2,
    spread: ask - bid,
    timestamp: new Date(),
});

const mockSnapshot = {
    pair: 'ETHUSDT',
    prices: [
        makePrice('binance', 1800, 1801),
        makePrice('coinbase', 1810, 1811),
    ],
    fetchedAt: new Date(),
};

beforeEach(() => {
    MockedFetcher.mockClear();
    MockedGasOptimizer.mockClear();

    MockedFetcher.prototype.fetchMultiplePairs = jest.fn().mockResolvedValue([mockSnapshot]);
    MockedGasOptimizer.prototype.estimateGasCostForTransaction = jest.fn().mockResolvedValue({
        gasLimit: 300_000,
        gasPriceGwei: 20,
        costEth: 0.006,
    });
});

describe('ArbitrageEngine', () => {
    describe('detectCrossExchangeOpportunities', () => {
        it('detects opportunity when coinbase bid > binance ask (adjusted for slippage)', () => {
            const engine = new ArbitrageEngine({ slippageTolerance: 0, defaultTradeAmountEth: 1 });
            const opportunities = engine.detectCrossExchangeOpportunities(mockSnapshot, 0);

            // Buy on binance (ask=1801), sell on coinbase (bid=1810)
            const opp = opportunities.find(
                (o) => o.buyExchange === 'binance' && o.sellExchange === 'coinbase'
            );
            expect(opp).toBeDefined();
            expect(opp!.sellPrice).toBeGreaterThan(opp!.buyPrice);
            expect(opp!.grossProfitRatio).toBeGreaterThan(0);
        });

        it('does not detect opportunity when prices are equal', () => {
            const engine = new ArbitrageEngine({ slippageTolerance: 0 });
            const equalSnapshot = {
                pair: 'ETHUSDT',
                prices: [makePrice('binance', 1800, 1800), makePrice('coinbase', 1800, 1800)],
                fetchedAt: new Date(),
            };
            const opportunities = engine.detectCrossExchangeOpportunities(equalSnapshot, 0);
            // No opportunity because bid == ask, so sellPrice <= buyPrice
            const profitable = opportunities.filter((o) => o.isProfitable);
            expect(profitable).toHaveLength(0);
        });

        it('marks opportunity as not profitable when gas cost exceeds gross profit', () => {
            const engine = new ArbitrageEngine({ slippageTolerance: 0, defaultTradeAmountEth: 0.001 });
            const opportunities = engine.detectCrossExchangeOpportunities(mockSnapshot, 100); // huge gas cost
            const profitable = opportunities.filter((o) => o.isProfitable);
            expect(profitable).toHaveLength(0);
        });

        it('returns empty array when fewer than 2 exchanges are available', () => {
            const engine = new ArbitrageEngine();
            const singleExchangeSnapshot = {
                pair: 'ETHUSDT',
                prices: [makePrice('binance', 1800, 1801)],
                fetchedAt: new Date(),
            };
            const opportunities = engine.detectCrossExchangeOpportunities(singleExchangeSnapshot, 0);
            expect(opportunities).toHaveLength(0);
        });
    });

    describe('detectTriangularOpportunity', () => {
        it('identifies profitable triangular arbitrage', () => {
            const engine = new ArbitrageEngine({ slippageTolerance: 0, defaultTradeAmountEth: 1 });
            const priceAB = makePrice('binance', 1.05, 1.06);
            const priceBC = makePrice('coinbase', 1.04, 1.05);
            const priceCA = makePrice('uniswap-v3', 0.92, 0.93);
            // rateAB * rateBC * rateCA - 1 = 1.05 * 1.04 * 0.92 - 1 ≈ 0.00566

            const result = engine.detectTriangularOpportunity(priceAB, priceBC, priceCA, 0);
            expect(result.type).toBe('triangular');
            expect(result.profitRatio).toBeCloseTo(1.05 * 1.04 * 0.92 - 1, 5);
        });

        it('marks triangular opportunity as not profitable after gas', () => {
            const engine = new ArbitrageEngine({ slippageTolerance: 0, defaultTradeAmountEth: 1 });
            const priceAB = makePrice('binance', 1.001, 1.002);
            const priceBC = makePrice('coinbase', 1.001, 1.002);
            const priceCA = makePrice('uniswap-v3', 1.001, 1.002);
            // Very small spread, will not cover a large gas cost
            const result = engine.detectTriangularOpportunity(priceAB, priceBC, priceCA, 10);
            expect(result.isProfitable).toBe(false);
        });
    });

    describe('findOpportunities', () => {
        it('returns only opportunities above the minimum profit threshold', async () => {
            // With costEth=0.006 and small trade amount the net may be negative
            const engine = new ArbitrageEngine({
                minProfitThresholdEth: 0.0001,
                slippageTolerance: 0,
                defaultTradeAmountEth: 10,
            });
            const results = await engine.findOpportunities(['ETHUSDT']);
            // All returned results must be profitable and above threshold
            for (const r of results) {
                expect(r.isProfitable).toBe(true);
                expect(r.netProfitEth).toBeGreaterThanOrEqual(0.0001);
            }
        });

        it('returns results sorted by net profit descending', async () => {
            const engine = new ArbitrageEngine({ slippageTolerance: 0, defaultTradeAmountEth: 100 });
            const results = await engine.findOpportunities(['ETHUSDT']);
            for (let i = 1; i < results.length; i++) {
                expect(results[i - 1].netProfitEth).toBeGreaterThanOrEqual(results[i].netProfitEth);
            }
        });
    });
});
