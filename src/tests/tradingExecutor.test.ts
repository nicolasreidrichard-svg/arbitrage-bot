// src/tests/tradingExecutor.test.ts
// Unit tests for the Trading Executor Module

import TradingExecutor from '../modules/tradingExecutor';
import TradeExecutorEnhanced from '../integrations/trade-executor-enhanced';
import GasOptimizer from '../modules/gasOptimizer';
import { OpportunityResult } from '../modules/arbitrageEngine';

jest.mock('../integrations/trade-executor-enhanced');
jest.mock('../modules/gasOptimizer');
jest.mock('../utils/logger', () => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const MockedEnhanced = TradeExecutorEnhanced as jest.MockedClass<typeof TradeExecutorEnhanced>;
const MockedGasOptimizer = GasOptimizer as jest.MockedClass<typeof GasOptimizer>;

const mockSuccessResult = {
    success: true,
    estimatedProfitEth: 0.005,
    profitRouted: false,
};

const mockFailResult = {
    success: false,
    estimatedProfitEth: 0,
    profitRouted: false,
    error: 'execution failed',
};

const mockOpportunity: OpportunityResult = {
    type: 'cross-exchange',
    pair: 'ETHUSDT',
    buyExchange: 'binance',
    sellExchange: 'coinbase',
    buyPrice: 1800,
    sellPrice: 1810,
    grossProfitRatio: 0.0055,
    estimatedGasCostEth: 0.002,
    tradeAmountEth: 1,
    grossProfitEth: 0.0055,
    netProfitEth: 0.0035,
    isProfitable: true,
    slippageEstimate: 0.005,
    detectedAt: new Date(),
};

beforeEach(() => {
    MockedEnhanced.mockClear();
    MockedGasOptimizer.mockClear();

    MockedEnhanced.prototype.executeArbitrage = jest.fn().mockResolvedValue({
        buyResult: mockSuccessResult,
        sellResult: mockSuccessResult,
    });
    MockedEnhanced.prototype.executeTrade = jest.fn().mockResolvedValue(mockSuccessResult);

    MockedGasOptimizer.prototype.estimateGasCostForTransaction = jest.fn().mockResolvedValue({
        gasLimit: 300_000,
        gasPriceGwei: 20,
        costEth: 0.006,
    });
});

describe('TradingExecutor', () => {
    describe('executeArbitrageOpportunity', () => {
        it('returns a confirmed result on success', async () => {
            const executor = new TradingExecutor();
            const result = await executor.executeArbitrageOpportunity(mockOpportunity, 1);

            expect(result.success).toBe(true);
            expect(result.state).toBe('confirmed');
            expect(result.transactionId).toMatch(/^tx-/);
        });

        it('returns a failed result when the underlying execution throws', async () => {
            MockedEnhanced.prototype.executeArbitrage = jest
                .fn()
                .mockRejectedValue(new Error('rpc error'));

            const executor = new TradingExecutor();
            const result = await executor.executeArbitrageOpportunity(mockOpportunity, 1);

            expect(result.success).toBe(false);
            expect(result.state).toBe('failed');
        });

        it('tracks the transaction state correctly', async () => {
            const executor = new TradingExecutor();
            const result = await executor.executeArbitrageOpportunity(mockOpportunity, 1);

            const tracked = executor.getTransactionState(result.transactionId);
            expect(tracked).toBeDefined();
            expect(tracked!.state).toBe('confirmed');
            expect(tracked!.id).toBe(result.transactionId);
        });
    });

    describe('executeSingleTrade', () => {
        it('returns a confirmed result with a transaction ID', async () => {
            const executor = new TradingExecutor();
            const result = await executor.executeSingleTrade({
                symbol: 'ETHUSDT',
                side: 'buy',
                quantity: 1,
                price: 1800,
                exchange: 'binance',
                autoRouteProfit: false,
                profitThresholdEth: 0,
            });

            expect(result.success).toBe(true);
            expect(result.transactionId).toMatch(/^tx-/);
        });

        it('handles trade execution failure gracefully', async () => {
            MockedEnhanced.prototype.executeTrade = jest
                .fn()
                .mockResolvedValue(mockFailResult);

            const executor = new TradingExecutor();
            const result = await executor.executeSingleTrade({
                symbol: 'ETHUSDT',
                side: 'buy',
                quantity: 1,
                price: 1800,
                exchange: 'binance',
                autoRouteProfit: false,
                profitThresholdEth: 0,
            });

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('getTransactionsByState', () => {
        it('returns all transactions in the requested state', async () => {
            const executor = new TradingExecutor();
            await executor.executeArbitrageOpportunity(mockOpportunity, 1);
            await executor.executeArbitrageOpportunity(mockOpportunity, 1);

            const confirmed = executor.getTransactionsByState('confirmed');
            expect(confirmed.length).toBeGreaterThanOrEqual(2);
        });

        it('returns empty array when no transactions match the state', () => {
            const executor = new TradingExecutor();
            expect(executor.getTransactionsByState('pending')).toHaveLength(0);
        });
    });
});
