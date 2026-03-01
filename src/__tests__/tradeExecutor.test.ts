// src/__tests__/tradeExecutor.test.ts

import TradeExecutor, { TradeDetails } from '../services/tradeExecutor';

// Silence logger output during tests
jest.mock('../utils/logger', () => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
}));

const validTrade: TradeDetails = {
    symbol: 'ETH',
    quantity: 1.5,
    price: 2000,
    exchange: 'binance'
};

describe('TradeExecutor', () => {
    let executor: TradeExecutor;

    beforeEach(() => {
        executor = new TradeExecutor();
    });

    describe('executeTrade', () => {
        it('returns a successful TradeResult for valid input', () => {
            const result = executor.executeTrade(validTrade);
            expect(result.success).toBe(true);
            expect(result.message).toContain('ETH');
            expect(result.executedPrice.symbol).toBe('ETH');
            expect(result.executedPrice.value).toBe(2000);
            expect(result.executedPrice.timestamp).toBeInstanceOf(Date);
        });

        it('throws for missing symbol', () => {
            expect(() => executor.executeTrade({ ...validTrade, symbol: '' })).toThrow(
                'Invalid trade details provided'
            );
        });

        it('throws for zero quantity', () => {
            expect(() => executor.executeTrade({ ...validTrade, quantity: 0 })).toThrow(
                'Invalid trade details provided'
            );
        });

        it('throws for negative price', () => {
            expect(() => executor.executeTrade({ ...validTrade, price: -1 })).toThrow(
                'Invalid trade details provided'
            );
        });

        it('accumulates pending trades', () => {
            executor.executeTrade(validTrade);
            executor.executeTrade({ ...validTrade, symbol: 'BTC' });
            expect(executor.getPendingTrades()).toHaveLength(2);
        });

        it('clearPendingTrades empties the list', () => {
            executor.executeTrade(validTrade);
            executor.clearPendingTrades();
            expect(executor.getPendingTrades()).toHaveLength(0);
        });
    });

    describe('optimizeGasPrices', () => {
        it('returns valid GasOptions with defaults', () => {
            const opts = executor.optimizeGasPrices();
            expect(opts.gasPrice).toBeGreaterThanOrEqual(1);
            expect(opts.gasLimit).toBeGreaterThanOrEqual(21000);
        });

        it('respects provided options', () => {
            const opts = executor.optimizeGasPrices({ gasPrice: 50, gasLimit: 100000 });
            expect(opts.gasPrice).toBe(50);
            expect(opts.gasLimit).toBe(100000);
        });
    });

    describe('logTransaction', () => {
        it('does not throw for a valid object', () => {
            expect(() => executor.logTransaction({ hash: '0xabc', status: 'confirmed' })).not.toThrow();
        });

        it('throws for null input', () => {
            expect(() => executor.logTransaction(null as unknown as Record<string, unknown>)).toThrow(
                'transactionDetails must be a non-null object'
            );
        });
    });
});
