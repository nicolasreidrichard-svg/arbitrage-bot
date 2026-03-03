// src/tests/marketDataFetcher.test.ts
// Unit tests for the Market Data Fetcher Module

import MarketDataFetcher from '../modules/marketDataFetcher';
import ExchangeConnector from '../integrations/exchange-connector';

jest.mock('../integrations/exchange-connector');
jest.mock('../utils/logger', () => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const MockedConnector = ExchangeConnector as jest.MockedClass<typeof ExchangeConnector>;

const makeMockPrice = (exchange: string, bid: number, ask: number) => ({
    exchange,
    pair: 'ETHUSDT',
    bid,
    ask,
    timestamp: new Date(),
});

const mockPrices = [
    makeMockPrice('binance', 1800, 1801),
    makeMockPrice('coinbase', 1802, 1803),
];

beforeEach(() => {
    MockedConnector.mockClear();
    MockedConnector.prototype.fetchPricesFromAll = jest.fn().mockResolvedValue(mockPrices);
});

describe('MarketDataFetcher', () => {
    describe('fetchMarketSnapshot', () => {
        it('returns a normalised snapshot with mid and spread fields', async () => {
            const fetcher = new MarketDataFetcher();
            const snapshot = await fetcher.fetchMarketSnapshot('ETHUSDT');

            expect(snapshot.pair).toBe('ETHUSDT');
            expect(snapshot.prices).toHaveLength(2);

            const binance = snapshot.prices.find((p) => p.exchange === 'binance')!;
            expect(binance.mid).toBeCloseTo((1800 + 1801) / 2, 5);
            expect(binance.spread).toBeCloseTo(1801 - 1800, 5);
        });

        it('uses cached snapshot within TTL', async () => {
            const fetcher = new MarketDataFetcher(10_000);
            await fetcher.fetchMarketSnapshot('ETHUSDT');
            await fetcher.fetchMarketSnapshot('ETHUSDT');

            expect(MockedConnector.prototype.fetchPricesFromAll).toHaveBeenCalledTimes(1);
        });

        it('re-fetches after cache is invalidated', async () => {
            const fetcher = new MarketDataFetcher(10_000);
            await fetcher.fetchMarketSnapshot('ETHUSDT');
            fetcher.invalidateCache('ETHUSDT');
            await fetcher.fetchMarketSnapshot('ETHUSDT');

            expect(MockedConnector.prototype.fetchPricesFromAll).toHaveBeenCalledTimes(2);
        });

        it('retries on failure and returns empty prices after exhausting retries', async () => {
            MockedConnector.prototype.fetchPricesFromAll = jest.fn().mockRejectedValue(new Error('network error'));
            const fetcher = new MarketDataFetcher(0, 2, 0); // 2 retries, no delay
            const snapshot = await fetcher.fetchMarketSnapshot('ETHUSDT');

            expect(snapshot.prices).toHaveLength(0);
            expect(MockedConnector.prototype.fetchPricesFromAll).toHaveBeenCalledTimes(2);
        });
    });

    describe('fetchMultiplePairs', () => {
        it('returns snapshots for all successfully fetched pairs', async () => {
            const fetcher = new MarketDataFetcher();
            const snapshots = await fetcher.fetchMultiplePairs(['ETHUSDT', 'BTCUSDT']);
            expect(snapshots).toHaveLength(2);
        });
    });

    describe('getBestBidAsk', () => {
        it('returns the exchange with highest bid as bestBid', async () => {
            const fetcher = new MarketDataFetcher();
            const snapshot = await fetcher.fetchMarketSnapshot('ETHUSDT');
            const { bestBid } = fetcher.getBestBidAsk(snapshot);

            expect(bestBid).not.toBeNull();
            expect(bestBid!.exchange).toBe('coinbase'); // bid 1802 > 1800
        });

        it('returns the exchange with lowest ask as bestAsk', async () => {
            const fetcher = new MarketDataFetcher();
            const snapshot = await fetcher.fetchMarketSnapshot('ETHUSDT');
            const { bestAsk } = fetcher.getBestBidAsk(snapshot);

            expect(bestAsk).not.toBeNull();
            expect(bestAsk!.exchange).toBe('binance'); // ask 1801 < 1803
        });

        it('returns null for both when no prices are available', () => {
            const fetcher = new MarketDataFetcher();
            const emptySnapshot = { pair: 'ETHUSDT', prices: [], fetchedAt: new Date() };
            const { bestBid, bestAsk } = fetcher.getBestBidAsk(emptySnapshot);

            expect(bestBid).toBeNull();
            expect(bestAsk).toBeNull();
        });
    });
});
