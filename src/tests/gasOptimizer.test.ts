// src/tests/gasOptimizer.test.ts
// Unit tests for the Gas Optimization Module

import GasOptimizer, { GAS_LIMITS } from '../modules/gasOptimizer';
import GasOptimizerEnhanced from '../integrations/gas-optimizer-enhanced';

// Mock the enhanced optimizer to avoid real API calls
jest.mock('../integrations/gas-optimizer-enhanced');
jest.mock('../utils/logger', () => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const MockedEnhanced = GasOptimizerEnhanced as jest.MockedClass<typeof GasOptimizerEnhanced>;

const mockEthEstimate = {
    safeLow: 10,
    standard: 20,
    fast: 40,
    fastest: 60,
    baseFee: 15,
    suggestedMaxPriorityFee: 2,
    source: 'mock',
    timestamp: new Date(),
};

beforeEach(() => {
    MockedEnhanced.mockClear();
    MockedEnhanced.prototype.getEthGasEstimate = jest.fn().mockResolvedValue(mockEthEstimate);
    MockedEnhanced.prototype.estimateEthTransactionCost = jest
        .fn()
        .mockImplementation((gasPriceGwei: number, gasLimit: number) => (gasPriceGwei * gasLimit) / 1e9);
});

describe('GasOptimizer', () => {
    describe('getGasEstimate', () => {
        it('normalises the ETH estimate into the GasEstimate shape', async () => {
            const optimizer = new GasOptimizer();
            const estimate = await optimizer.getGasEstimate();

            expect(estimate.standard).toBe(20);
            expect(estimate.fast).toBe(40);
            expect(estimate.instant).toBe(60);
            expect(estimate.baseFee).toBe(15);
            expect(estimate.source).toBe('mock');
            expect(estimate.timestamp).toBeInstanceOf(Date);
        });

        it('returns cached data within TTL without calling the API again', async () => {
            const optimizer = new GasOptimizer(10_000); // 10 s TTL
            await optimizer.getGasEstimate();
            await optimizer.getGasEstimate();

            expect(MockedEnhanced.prototype.getEthGasEstimate).toHaveBeenCalledTimes(1);
        });
    });

    describe('estimateGasCostForTransaction', () => {
        it('calculates cost for a known transaction type', async () => {
            const optimizer = new GasOptimizer();
            const result = await optimizer.estimateGasCostForTransaction('transfer', 'standard');

            expect(result.gasLimit).toBe(GAS_LIMITS['transfer']);
            expect(result.gasPriceGwei).toBe(20); // standard price from mock
            expect(result.costEth).toBeCloseTo((20 * 21_000) / 1e9, 8);
        });

        it('falls back to arbitrageTrade gas limit for unknown tx types', async () => {
            const optimizer = new GasOptimizer();
            const result = await optimizer.estimateGasCostForTransaction('unknownType');
            expect(result.gasLimit).toBe(GAS_LIMITS['arbitrageTrade']);
        });

        it('uses fast gas price when priority is fast', async () => {
            const optimizer = new GasOptimizer();
            const result = await optimizer.estimateGasCostForTransaction('uniswapSwap', 'fast');
            expect(result.gasPriceGwei).toBe(40);
        });
    });

    describe('calculateNetProfit', () => {
        it('returns positive net profit when gross > gas cost', () => {
            const optimizer = new GasOptimizer();
            const result = optimizer.calculateNetProfit(0.01, 0.001);

            expect(result.grossProfitEth).toBe(0.01);
            expect(result.gasCostEth).toBe(0.001);
            expect(result.netProfitEth).toBeCloseTo(0.009, 8);
            expect(result.isProfitable).toBe(true);
        });

        it('returns isProfitable=false when gas cost exceeds gross profit', () => {
            const optimizer = new GasOptimizer();
            const result = optimizer.calculateNetProfit(0.001, 0.005);
            expect(result.isProfitable).toBe(false);
            expect(result.netProfitEth).toBeCloseTo(-0.004, 8);
        });
    });

    describe('isNetworkCongested', () => {
        it('detects congestion when fast price > 2x standard', async () => {
            MockedEnhanced.prototype.getEthGasEstimate = jest.fn().mockResolvedValue({
                ...mockEthEstimate,
                standard: 10,
                fast: 25, // > 2x standard
            });
            const optimizer = new GasOptimizer(0); // TTL=0 to force refresh
            const congested = await optimizer.isNetworkCongested();
            expect(congested).toBe(true);
        });

        it('returns false when network is not congested', async () => {
            const optimizer = new GasOptimizer(0);
            const congested = await optimizer.isNetworkCongested();
            expect(congested).toBe(false); // fast(40) is not > 2*standard(20) = 40
        });
    });

    describe('estimateBatchSavings', () => {
        it('calculates savings correctly for batching 3 transactions', () => {
            const optimizer = new GasOptimizer();
            const savings = optimizer.estimateBatchSavings(3, 20);

            const expectedIndividual = (20 * GAS_LIMITS['arbitrageTrade'] * 3) / 1e9;
            const expectedBatch = (20 * GAS_LIMITS['batchArbitrage']) / 1e9;

            expect(savings.individualCostEth).toBeCloseTo(expectedIndividual, 8);
            expect(savings.batchCostEth).toBeCloseTo(expectedBatch, 8);
            expect(savings.savingsEth).toBeCloseTo(expectedIndividual - expectedBatch, 8);
        });
    });
});
