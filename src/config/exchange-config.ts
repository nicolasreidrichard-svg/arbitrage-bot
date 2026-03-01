// exchange-config.ts
// Template for exchange-specific configurations

export interface ExchangeCredentials {
    apiKey: string;
    apiSecret: string;
    passphrase?: string; // required by some exchanges (e.g. Coinbase)
}

export interface ExchangeSettings {
    name: string;
    baseUrl: string;
    credentials: ExchangeCredentials;
    rateLimitMs: number;         // minimum ms between requests
    maxOrderSizeUsd: number;
    minOrderSizeUsd: number;
    takerFeePercent: number;
    makerFeePercent: number;
    enabled: boolean;
}

export interface ExchangeConfigMap {
    binance: ExchangeSettings;
    coinbase: ExchangeSettings;
    uniswap: {
        name: string;
        subgraphUrl: string;
        routerAddress: string;
        enabled: boolean;
    };
}

const exchangeConfig: ExchangeConfigMap = {
    binance: {
        name: 'Binance',
        baseUrl: 'https://api.binance.com',
        credentials: {
            apiKey: process.env.BINANCE_API_KEY || '',
            apiSecret: process.env.BINANCE_API_SECRET || '',
        },
        rateLimitMs: 100,
        maxOrderSizeUsd: parseFloat(process.env.BINANCE_MAX_ORDER_USD || '10000'),
        minOrderSizeUsd: 10,
        takerFeePercent: 0.1,
        makerFeePercent: 0.1,
        enabled: Boolean(process.env.BINANCE_API_KEY),
    },
    coinbase: {
        name: 'Coinbase Advanced Trade',
        baseUrl: 'https://api.coinbase.com/api/v3/brokerage',
        credentials: {
            apiKey: process.env.COINBASE_API_KEY || '',
            apiSecret: process.env.COINBASE_API_SECRET || '',
            passphrase: process.env.COINBASE_PASSPHRASE || '',
        },
        rateLimitMs: 200,
        maxOrderSizeUsd: parseFloat(process.env.COINBASE_MAX_ORDER_USD || '10000'),
        minOrderSizeUsd: 1,
        takerFeePercent: 0.06,
        makerFeePercent: 0.0,
        enabled: Boolean(process.env.COINBASE_API_KEY),
    },
    uniswap: {
        name: 'Uniswap V3',
        subgraphUrl:
            process.env.UNISWAP_SUBGRAPH_URL ||
            'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
        routerAddress:
            process.env.UNISWAP_ROUTER_ADDRESS ||
            '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        enabled: true,
    },
};

export default exchangeConfig;
