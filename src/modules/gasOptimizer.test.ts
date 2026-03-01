// src/modules/gasOptimizer.test.ts

import axios from 'axios';
import GasOptimizer from './gasOptimizer';
import { GasPriceTier } from '../types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const DEFAULT_TIER: GasPriceTier = { standard: 30, fast: 60, instant: 90 };

describe('GasOptimizer', () => {
    let optimizer: GasOptimizer;

    beforeEach(() => {
        optimizer = new GasOptimizer();
        // Reset to a known tier before each test.
        optimizer.setGasPriceTier(DEFAULT_TIER);
    });

    // ------------------------------------------------------------------
    // estimateGas
    // ------------------------------------------------------------------
    describe('estimateGas', () => {
        it('returns correct estimate for a swap transaction at fast price', () => {
            const estimate = optimizer.estimateGas('swap');
            expect(estimate.estimatedGas).toBe(150000);
            expect(estimate.gasPrice).toBe(DEFAULT_TIER.fast);
            expect(estimate.totalCostWei).toBe(150000 * DEFAULT_TIER.fast * 1e9);
            expect(estimate.totalCostEth).toBeCloseTo(
                (150000 * DEFAULT_TIER.fast * 1e9) / 1e18,
            );
        });

        it('returns correct estimate for an approve transaction', () => {
            const estimate = optimizer.estimateGas('approve', 30);
            expect(estimate.estimatedGas).toBe(46000);
            expect(estimate.gasPrice).toBe(30);
        });

        it('returns correct estimate for a transfer transaction', () => {
            const estimate = optimizer.estimateGas('transfer', 20);
            expect(estimate.estimatedGas).toBe(21000);
        });

        it('returns correct estimate for an arbitrage transaction', () => {
            const estimate = optimizer.estimateGas('arbitrage', 100);
            expect(estimate.estimatedGas).toBe(300000);
            expect(estimate.gasPrice).toBe(100);
        });

        it('uses the provided gas price rather than the default tier', () => {
            const customPrice = 200;
            const estimate = optimizer.estimateGas('swap', customPrice);
            expect(estimate.gasPrice).toBe(customPrice);
        });
    });

    // ------------------------------------------------------------------
    // calculateNetProfit
    // ------------------------------------------------------------------
    describe('calculateNetProfit', () => {
        it('returns positive net profit when gross profit exceeds gas cost', () => {
            // arbitrage gas at fast price (60 Gwei): 300000 * 60e9 / 1e18 = 0.018 ETH
            const netProfit = optimizer.calculateNetProfit(0.1, 'arbitrage');
            expect(netProfit).toBeGreaterThan(0);
            expect(netProfit).toBeCloseTo(0.1 - 300000 * 60 * 1e9 / 1e18, 8);
        });

        it('returns negative net profit when gas cost exceeds gross profit', () => {
            const netProfit = optimizer.calculateNetProfit(0.001, 'arbitrage', 200);
            expect(netProfit).toBeLessThan(0);
        });

        it('returns zero net profit when gross profit exactly equals gas cost', () => {
            const gasCostEth = (150000 * 60 * 1e9) / 1e18;
            const netProfit = optimizer.calculateNetProfit(gasCostEth, 'swap');
            expect(netProfit).toBeCloseTo(0, 8);
        });
    });

    // ------------------------------------------------------------------
    // getNetworkCongestion
    // ------------------------------------------------------------------
    describe('getNetworkCongestion', () => {
        it('returns "high" when instant gas price >= 100 Gwei', () => {
            optimizer.setGasPriceTier({ standard: 80, fast: 100, instant: 150 });
            expect(optimizer.getNetworkCongestion()).toBe('high');
        });

        it('returns "medium" when instant gas price is between 50 and 100 Gwei', () => {
            optimizer.setGasPriceTier({ standard: 30, fast: 50, instant: 80 });
            expect(optimizer.getNetworkCongestion()).toBe('medium');
        });

        it('returns "low" when instant gas price < 50 Gwei', () => {
            optimizer.setGasPriceTier({ standard: 10, fast: 20, instant: 30 });
            expect(optimizer.getNetworkCongestion()).toBe('low');
        });
    });

    // ------------------------------------------------------------------
    // getRecommendedGasPrice
    // ------------------------------------------------------------------
    describe('getRecommendedGasPrice', () => {
        it('recommends instant price on high congestion', () => {
            optimizer.setGasPriceTier({ standard: 80, fast: 120, instant: 200 });
            expect(optimizer.getRecommendedGasPrice()).toBe(200);
        });

        it('recommends fast price on medium congestion', () => {
            optimizer.setGasPriceTier({ standard: 30, fast: 60, instant: 80 });
            expect(optimizer.getRecommendedGasPrice()).toBe(60);
        });

        it('recommends standard price on low congestion', () => {
            optimizer.setGasPriceTier({ standard: 15, fast: 25, instant: 35 });
            expect(optimizer.getRecommendedGasPrice()).toBe(15);
        });
    });

    // ------------------------------------------------------------------
    // evaluateBatch
    // ------------------------------------------------------------------
    describe('evaluateBatch', () => {
        it('returns null when fewer than 2 transactions are provided', () => {
            expect(optimizer.evaluateBatch(['swap'])).toBeNull();
            expect(optimizer.evaluateBatch([])).toBeNull();
        });

        it('returns a BatchTransaction with savings for two or more transactions', () => {
            const batch = optimizer.evaluateBatch(['swap', 'approve']);
            expect(batch).not.toBeNull();
            expect(batch!.gasSavingsPercent).toBe(20);
            const individualGas = 150000 + 46000;
            expect(batch!.estimatedGas).toBe(Math.round(individualGas * 0.8));
        });

        it('includes all submitted transaction types in the batch result', () => {
            const types = ['arbitrage', 'approve', 'transfer'] as const;
            const batch = optimizer.evaluateBatch([...types]);
            expect(batch!.transactions).toEqual(types);
        });
    });

    // ------------------------------------------------------------------
    // isProfitableAfterGas
    // ------------------------------------------------------------------
    describe('isProfitableAfterGas', () => {
        it('returns true when net profit is positive', () => {
            expect(optimizer.isProfitableAfterGas(0.1)).toBe(true);
        });

        it('returns false when net profit is negative', () => {
            // arbitrage at 200 Gwei: 300000 * 200e9 / 1e18 = 0.06 ETH gas cost
            optimizer.setGasPriceTier({ standard: 200, fast: 200, instant: 200 });
            expect(optimizer.isProfitableAfterGas(0.001)).toBe(false);
        });
    });

    // ------------------------------------------------------------------
    // fetchGasPrices
    // ------------------------------------------------------------------
    describe('fetchGasPrices', () => {
        it('updates the gas price tier from the API response', async () => {
            mockedAxios.get.mockResolvedValueOnce({
                data: {
                    result: {
                        SafeGasPrice: '20',
                        ProposeGasPrice: '25',
                        FastGasPrice: '35',
                    },
                },
            });

            const tier = await optimizer.fetchGasPrices();
            expect(tier.standard).toBe(20);
            expect(tier.fast).toBe(25);
            expect(tier.instant).toBe(35);
        });

        it('keeps the previous tier when the API call fails', async () => {
            mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

            const tier = await optimizer.fetchGasPrices();
            expect(tier).toEqual(DEFAULT_TIER);
        });

        it('keeps the previous tier when the API returns no result', async () => {
            mockedAxios.get.mockResolvedValueOnce({ data: {} });

            const tier = await optimizer.fetchGasPrices();
            expect(tier).toEqual(DEFAULT_TIER);
        });
    });
});
