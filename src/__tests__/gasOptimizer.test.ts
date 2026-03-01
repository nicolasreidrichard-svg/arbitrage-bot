// src/__tests__/gasOptimizer.test.ts

import GasOptimizer from '../modules/gasOptimizer';

jest.mock('../utils/logger', () => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
}));

describe('GasOptimizer', () => {
    describe('constructor', () => {
        it('creates with default params', () => {
            const opt = new GasOptimizer();
            expect(opt.getBaseGasPrice()).toBe(20);
            expect(opt.getCongestionFactor()).toBe(1.0);
        });

        it('throws for non-positive baseGasPrice', () => {
            expect(() => new GasOptimizer(0)).toThrow('baseGasPrice must be positive');
            expect(() => new GasOptimizer(-5)).toThrow('baseGasPrice must be positive');
        });

        it('throws for non-positive congestionFactor', () => {
            expect(() => new GasOptimizer(20, 0)).toThrow('congestionFactor must be positive');
        });
    });

    describe('estimateGas', () => {
        const opt = new GasOptimizer(20, 1.0);

        it('returns correct gasPrice for standard speed', () => {
            const estimate = opt.estimateGas(21000, 'standard');
            expect(estimate.estimatedGas).toBe(21000);
            expect(estimate.gasPrice).toBeCloseTo(20, 5);
        });

        it('returns higher gasPrice for fast speed', () => {
            const fast = opt.estimateGas(21000, 'fast');
            const standard = opt.estimateGas(21000, 'standard');
            expect(fast.gasPrice).toBeGreaterThan(standard.gasPrice);
        });

        it('returns highest gasPrice for instant speed', () => {
            const instant = opt.estimateGas(21000, 'instant');
            const fast = opt.estimateGas(21000, 'fast');
            expect(instant.gasPrice).toBeGreaterThan(fast.gasPrice);
        });

        it('throws for non-positive gasLimit', () => {
            expect(() => opt.estimateGas(0)).toThrow('gasLimit must be positive');
            expect(() => opt.estimateGas(-1)).toThrow('gasLimit must be positive');
        });
    });

    describe('recommendGasOptions', () => {
        it('returns three recommendations', () => {
            const opt = new GasOptimizer(20);
            const recs = opt.recommendGasOptions(21000);
            expect(recs).toHaveLength(3);
            const speeds = recs.map((r) => r.speed);
            expect(speeds).toContain('standard');
            expect(speeds).toContain('fast');
            expect(speeds).toContain('instant');
        });

        it('all recommendations have positive estimated cost', () => {
            const opt = new GasOptimizer(20);
            const recs = opt.recommendGasOptions(21000);
            recs.forEach((r) => expect(r.estimatedCostEth).toBeGreaterThan(0));
        });
    });

    describe('calculateNetProfit', () => {
        it('returns profitable=true when gross profit exceeds gas cost', () => {
            const opt = new GasOptimizer(20, 1.0);
            const result = opt.calculateNetProfit(1.0, 21000, 'standard');
            expect(result.profitable).toBe(true);
            expect(result.netProfit).toBeCloseTo(1.0 - result.gasCostEth, 6);
        });

        it('returns profitable=false when gas cost exceeds gross profit', () => {
            const opt = new GasOptimizer(1e12, 1.0); // extremely high gas price
            const result = opt.calculateNetProfit(0.000001, 21000, 'standard');
            expect(result.profitable).toBe(false);
        });

        it('throws for non-positive gasLimit', () => {
            const opt = new GasOptimizer(20);
            expect(() => opt.calculateNetProfit(1.0, 0)).toThrow('gasLimit must be positive');
        });

        it('accepts optional ethPriceUsd without error', () => {
            const opt = new GasOptimizer(20);
            expect(() => opt.calculateNetProfit(0.1, 21000, 'standard', 2000)).not.toThrow();
        });
    });

    describe('updateBaseGasPrice', () => {
        it('updates the base gas price', () => {
            const opt = new GasOptimizer(20);
            opt.updateBaseGasPrice(50);
            expect(opt.getBaseGasPrice()).toBe(50);
        });

        it('throws for non-positive value', () => {
            const opt = new GasOptimizer(20);
            expect(() => opt.updateBaseGasPrice(0)).toThrow('newBaseGasPrice must be positive');
        });
    });

    describe('updateCongestionFactor', () => {
        it('updates the congestion factor', () => {
            const opt = new GasOptimizer(20);
            opt.updateCongestionFactor(2.0);
            expect(opt.getCongestionFactor()).toBe(2.0);
        });

        it('throws for non-positive value', () => {
            const opt = new GasOptimizer(20);
            expect(() => opt.updateCongestionFactor(-1)).toThrow('congestionFactor must be positive');
        });
    });
});
