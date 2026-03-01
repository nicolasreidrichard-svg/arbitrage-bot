// exchange-connector.ts
// Template for connecting to multiple exchanges: Binance, Uniswap, Coinbase, etc.

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import logger from '../utils/logger';

export interface ExchangePrice {
    exchange: string;
    pair: string;
    bid: number;
    ask: number;
    timestamp: Date;
}

export interface ExchangeBalance {
    asset: string;
    free: number;
    locked: number;
}

export interface ExchangeOrder {
    orderId: string;
    exchange: string;
    pair: string;
    side: 'buy' | 'sell';
    quantity: number;
    price: number;
    status: string;
}

// ─── Binance Connector ──────────────────────────────────────────────────────

class BinanceConnector {
    private client: AxiosInstance;
    private apiKey: string;
    private apiSecret: string;
    private baseUrl: string;

    constructor() {
        this.apiKey = process.env.BINANCE_API_KEY || '';
        this.apiSecret = process.env.BINANCE_API_SECRET || '';
        this.baseUrl = 'https://api.binance.com';
        this.client = axios.create({ baseURL: this.baseUrl });
    }

    private sign(queryString: string): string {
        return crypto.createHmac('sha256', this.apiSecret).update(queryString).digest('hex');
    }

    async getPrice(symbol: string): Promise<ExchangePrice> {
        const response = await this.client.get('/api/v3/ticker/bookTicker', {
            params: { symbol },
        });
        return {
            exchange: 'binance',
            pair: symbol,
            bid: parseFloat(response.data.bidPrice),
            ask: parseFloat(response.data.askPrice),
            timestamp: new Date(),
        };
    }

    async getBalances(): Promise<ExchangeBalance[]> {
        const timestamp = Date.now();
        const queryString = `timestamp=${timestamp}`;
        const signature = this.sign(queryString);

        const response = await this.client.get('/api/v3/account', {
            params: { timestamp, signature },
            headers: { 'X-MBX-APIKEY': this.apiKey },
        });

        return response.data.balances
            .filter((b: ExchangeBalance) => parseFloat(String(b.free)) > 0 || parseFloat(String(b.locked)) > 0)
            .map((b: { asset: string; free: string; locked: string }) => ({
                asset: b.asset,
                free: parseFloat(b.free),
                locked: parseFloat(b.locked),
            }));
    }

    async placeOrder(
        symbol: string,
        side: 'BUY' | 'SELL',
        quantity: number,
        price: number
    ): Promise<ExchangeOrder> {
        const timestamp = Date.now();
        const params = {
            symbol,
            side,
            type: 'LIMIT',
            timeInForce: 'GTC',
            quantity,
            price,
            timestamp,
        };
        const queryString = Object.entries(params)
            .map(([k, v]) => `${k}=${v}`)
            .join('&');
        const signature = this.sign(queryString);

        const response = await this.client.post('/api/v3/order', null, {
            params: { ...params, signature },
            headers: { 'X-MBX-APIKEY': this.apiKey },
        });

        return {
            orderId: String(response.data.orderId),
            exchange: 'binance',
            pair: symbol,
            side: side.toLowerCase() as 'buy' | 'sell',
            quantity,
            price,
            status: response.data.status,
        };
    }
}

// ─── Coinbase Advanced Trade Connector ──────────────────────────────────────

class CoinbaseConnector {
    private client: AxiosInstance;
    private apiKey: string;
    private apiSecret: string;
    private baseUrl: string;

    constructor() {
        this.apiKey = process.env.COINBASE_API_KEY || '';
        this.apiSecret = process.env.COINBASE_API_SECRET || '';
        this.baseUrl = 'https://api.coinbase.com/api/v3/brokerage';
        this.client = axios.create({ baseURL: this.baseUrl });
    }

    private getAuthHeaders(method: string, path: string, body = ''): Record<string, string> {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const message = timestamp + method + path + body;
        const signature = crypto
            .createHmac('sha256', this.apiSecret)
            .update(message)
            .digest('hex');

        return {
            'CB-ACCESS-KEY': this.apiKey,
            'CB-ACCESS-SIGN': signature,
            'CB-ACCESS-TIMESTAMP': timestamp,
            'Content-Type': 'application/json',
        };
    }

    async getPrice(productId: string): Promise<ExchangePrice> {
        const path = `/best_bid_ask?product_ids=${productId}`;
        const response = await this.client.get(path, {
            headers: this.getAuthHeaders('GET', `/api/v3/brokerage${path}`),
        });

        const pricebook = response.data.pricebooks[0];
        return {
            exchange: 'coinbase',
            pair: productId,
            bid: parseFloat(pricebook.bids[0]?.price || '0'),
            ask: parseFloat(pricebook.asks[0]?.price || '0'),
            timestamp: new Date(),
        };
    }
}

// ─── Uniswap V3 Quote Connector ──────────────────────────────────────────────

class UniswapConnector {
    private graphqlUrl: string;

    constructor() {
        this.graphqlUrl =
            process.env.UNISWAP_SUBGRAPH_URL ||
            'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3';
    }

    async getPoolPrice(token0: string, token1: string): Promise<ExchangePrice> {
        const query = `{
            pools(where: { token0: "${token0.toLowerCase()}", token1: "${token1.toLowerCase()}" }, first: 1, orderBy: liquidity, orderDirection: desc) {
                token0Price
                token1Price
            }
        }`;

        const response = await axios.post(this.graphqlUrl, { query });
        const pool = response.data.data?.pools?.[0];

        return {
            exchange: 'uniswap-v3',
            pair: `${token0}/${token1}`,
            bid: parseFloat(pool?.token0Price || '0'),
            ask: parseFloat(pool?.token1Price || '0'),
            timestamp: new Date(),
        };
    }
}

// ─── Exchange Connector Factory ──────────────────────────────────────────────

class ExchangeConnector {
    readonly binance: BinanceConnector;
    readonly coinbase: CoinbaseConnector;
    readonly uniswap: UniswapConnector;

    constructor() {
        this.binance = new BinanceConnector();
        this.coinbase = new CoinbaseConnector();
        this.uniswap = new UniswapConnector();
    }

    async fetchPricesFromAll(symbol: string): Promise<ExchangePrice[]> {
        logger.log(`Fetching prices for ${symbol} from all exchanges`);

        const results = await Promise.allSettled([
            this.binance.getPrice(symbol),
            this.coinbase.getPrice(symbol.replace('USDT', '-USD')),
        ]);

        return results
            .filter((r): r is PromiseFulfilledResult<ExchangePrice> => r.status === 'fulfilled')
            .map((r) => r.value);
    }
}

export { BinanceConnector, CoinbaseConnector, UniswapConnector };
export default ExchangeConnector;
