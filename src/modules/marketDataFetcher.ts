// src/modules/marketDataFetcher.ts
// Market Data Fetcher Module – fetches and normalises real-time prices from
// multiple exchanges (Binance, Coinbase, Uniswap V3) with caching and retry logic.

import ExchangeConnector, { ExchangePrice } from '../integrations/exchange-connector';
import logger from '../utils/logger';

export interface NormalizedPrice {
    exchange: string;
    pair: string;
    bid: number;
    ask: number;
    mid: number;
    spread: number;
    timestamp: Date;
}

export interface MarketSnapshot {
    pair: string;
    prices: NormalizedPrice[];
    fetchedAt: Date;
}

export interface CacheEntry {
    snapshot: MarketSnapshot;
    expiresAt: number;
}

const DEFAULT_TTL_MS = 5_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

class MarketDataFetcher {
    private connector: ExchangeConnector;
    private cache: Map<string, CacheEntry> = new Map();
    private readonly ttlMs: number;
    private readonly maxRetries: number;
    private readonly retryDelayMs: number;

    constructor(
        ttlMs = DEFAULT_TTL_MS,
        maxRetries = DEFAULT_MAX_RETRIES,
        retryDelayMs = DEFAULT_RETRY_DELAY_MS
    ) {
        this.connector = new ExchangeConnector();
        this.ttlMs = ttlMs;
        this.maxRetries = maxRetries;
        this.retryDelayMs = retryDelayMs;
    }

    // Fetch prices for a trading pair from all configured exchanges.
    // Returns cached data if still fresh.
    async fetchMarketSnapshot(pair: string): Promise<MarketSnapshot> {
        const cached = this.cache.get(pair);
        if (cached && Date.now() < cached.expiresAt) {
            logger.log(`Cache hit for ${pair}`);
            return cached.snapshot;
        }

        const rawPrices = await this.fetchWithRetry(pair);
        const prices = rawPrices.map(this.normalize);

        const snapshot: MarketSnapshot = {
            pair,
            prices,
            fetchedAt: new Date(),
        };

        this.cache.set(pair, { snapshot, expiresAt: Date.now() + this.ttlMs });
        return snapshot;
    }

    // Fetch prices for multiple trading pairs concurrently.
    async fetchMultiplePairs(pairs: string[]): Promise<MarketSnapshot[]> {
        const results = await Promise.allSettled(
            pairs.map((pair) => this.fetchMarketSnapshot(pair))
        );

        return results
            .filter((r): r is PromiseFulfilledResult<MarketSnapshot> => r.status === 'fulfilled')
            .map((r) => r.value);
    }

    // Invalidate cache entry for a trading pair.
    invalidateCache(pair: string): void {
        this.cache.delete(pair);
    }

    // Return the best bid/ask across all exchanges for a given pair.
    getBestBidAsk(snapshot: MarketSnapshot): { bestBid: NormalizedPrice | null; bestAsk: NormalizedPrice | null } {
        if (snapshot.prices.length === 0) {
            return { bestBid: null, bestAsk: null };
        }
        const bestBid = snapshot.prices.reduce((a, b) => (a.bid > b.bid ? a : b));
        const bestAsk = snapshot.prices.reduce((a, b) => (a.ask < b.ask ? a : b));
        return { bestBid, bestAsk };
    }

    private normalize(raw: ExchangePrice): NormalizedPrice {
        const mid = (raw.bid + raw.ask) / 2;
        const spread = raw.ask - raw.bid;
        return {
            exchange: raw.exchange,
            pair: raw.pair,
            bid: raw.bid,
            ask: raw.ask,
            mid,
            spread,
            timestamp: raw.timestamp,
        };
    }

    private async fetchWithRetry(pair: string): Promise<ExchangePrice[]> {
        let lastError: unknown;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const prices = await this.connector.fetchPricesFromAll(pair);
                if (prices.length > 0) {
                    return prices;
                }
                logger.warn(`No prices returned for ${pair} on attempt ${attempt}`);
            } catch (error) {
                lastError = error;
                logger.warn(`Fetch attempt ${attempt}/${this.maxRetries} for ${pair} failed: ${error}`);
                if (attempt < this.maxRetries) {
                    await sleep(this.retryDelayMs * attempt);
                }
            }
        }
        logger.error(`All ${this.maxRetries} fetch attempts failed for ${pair}: ${lastError}`);
        return [];
    }
}

export default MarketDataFetcher;
