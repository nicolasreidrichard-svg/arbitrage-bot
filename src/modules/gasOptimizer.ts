// src/modules/gasOptimizer.ts

import axios from 'axios';
import {
    GasEstimate,
    GasPriceTier,
    NetworkCongestion,
    TransactionType,
    BatchTransaction,
} from '../types';

// Base gas units required per transaction type.
const GAS_LIMITS: Record<TransactionType, number> = {
    swap: 150000,
    approve: 46000,
    transfer: 21000,
    arbitrage: 300000,
};

// Percentage of gas saved when transactions are batched together.
const BATCH_SAVINGS_PERCENT = 20;

// Number of Wei in one Gwei and one ETH.
const WEI_PER_GWEI = 1e9;
const WEI_PER_ETH = 1e18;

// Congestion thresholds (Gwei): above "high" threshold => high congestion, etc.
const CONGESTION_THRESHOLD_HIGH = 100; // Gwei
const CONGESTION_THRESHOLD_MEDIUM = 50; // Gwei

class GasOptimizer {
    private gasPriceTier: GasPriceTier;
    private etherscanApiKey: string;
    private gasPriceApiUrl: string;

    constructor(etherscanApiKey = '', gasPriceApiUrl = 'https://api.etherscan.io/api') {
        this.etherscanApiKey = etherscanApiKey;
        this.gasPriceApiUrl = gasPriceApiUrl;
        // Default gas price tier (Gwei) used before the first API fetch.
        this.gasPriceTier = { standard: 30, fast: 60, instant: 90 };
    }

    /**
     * Fetch current gas prices from the Etherscan Gas Oracle and update the
     * internal gas price tier.  Falls back to the existing tier on error.
     */
    async fetchGasPrices(): Promise<GasPriceTier> {
        try {
            const response = await axios.get(this.gasPriceApiUrl, {
                params: {
                    module: 'gastracker',
                    action: 'gasoracle',
                    apikey: this.etherscanApiKey,
                },
            });

            const result = response.data?.result;
            if (result) {
                this.gasPriceTier = {
                    standard: parseFloat(result.SafeGasPrice),
                    fast: parseFloat(result.ProposeGasPrice),
                    instant: parseFloat(result.FastGasPrice),
                };
            }
        } catch {
            // Keep the current tier if the request fails.
        }

        return this.gasPriceTier;
    }

    /**
     * Return the current gas price tier without making a network request.
     */
    getGasPriceTier(): GasPriceTier {
        return { ...this.gasPriceTier };
    }

    /**
     * Manually override the gas price tier (useful for testing or when
     * integrating with a different data source).
     */
    setGasPriceTier(tier: GasPriceTier): void {
        this.gasPriceTier = { ...tier };
    }

    /**
     * Estimate the gas cost for a single transaction.
     *
     * @param txType     - The type of transaction.
     * @param gasPriceGwei - Gas price in Gwei.  Defaults to the "fast" tier.
     */
    estimateGas(
        txType: TransactionType,
        gasPriceGwei: number = this.gasPriceTier.fast,
    ): GasEstimate {
        const estimatedGas = GAS_LIMITS[txType];
        const gasPriceWei = gasPriceGwei * WEI_PER_GWEI;
        const totalCostWei = estimatedGas * gasPriceWei;
        const totalCostEth = totalCostWei / WEI_PER_ETH;

        return { estimatedGas, gasPrice: gasPriceGwei, totalCostWei, totalCostEth };
    }

    /**
     * Calculate the net profit after deducting gas costs.
     *
     * @param grossProfitEth - Gross profit in ETH before gas.
     * @param txType         - The type of transaction.
     * @param gasPriceGwei   - Gas price in Gwei.  Defaults to the "fast" tier.
     * @returns Net profit in ETH (can be negative).
     */
    calculateNetProfit(
        grossProfitEth: number,
        txType: TransactionType,
        gasPriceGwei: number = this.gasPriceTier.fast,
    ): number {
        const { totalCostEth } = this.estimateGas(txType, gasPriceGwei);
        return grossProfitEth - totalCostEth;
    }

    /**
     * Derive the current network congestion level from the "instant" gas price.
     */
    getNetworkCongestion(): NetworkCongestion {
        const instantPrice = this.gasPriceTier.instant;
        if (instantPrice >= CONGESTION_THRESHOLD_HIGH) return 'high';
        if (instantPrice >= CONGESTION_THRESHOLD_MEDIUM) return 'medium';
        return 'low';
    }

    /**
     * Recommend a gas price tier based on current network congestion.
     * On high congestion the bot uses the "instant" tier to avoid failed txs;
     * on medium it uses "fast"; on low it uses "standard" to save costs.
     */
    getRecommendedGasPrice(): number {
        const congestion = this.getNetworkCongestion();
        switch (congestion) {
            case 'high':
                return this.gasPriceTier.instant;
            case 'medium':
                return this.gasPriceTier.fast;
            default:
                return this.gasPriceTier.standard;
        }
    }

    /**
     * Evaluate whether batching a list of transactions would be beneficial
     * (i.e. gas savings outweigh the overhead).
     *
     * @param transactions - Array of transaction types to batch.
     * @returns A BatchTransaction descriptor, or null if batching is not worth it.
     */
    evaluateBatch(transactions: TransactionType[]): BatchTransaction | null {
        if (transactions.length < 2) return null;

        const individualGas = transactions.reduce(
            (sum, tx) => sum + GAS_LIMITS[tx],
            0,
        );
        const batchedGas = Math.round(individualGas * (1 - BATCH_SAVINGS_PERCENT / 100));

        return {
            transactions,
            estimatedGas: batchedGas,
            gasSavingsPercent: BATCH_SAVINGS_PERCENT,
        };
    }

    /**
     * Determine whether an arbitrage trade is profitable after gas costs.
     *
     * @param grossProfitEth - Gross profit in ETH.
     * @param txType         - Transaction type (defaults to 'arbitrage').
     * @returns true if the net profit is positive.
     */
    isProfitableAfterGas(
        grossProfitEth: number,
        txType: TransactionType = 'arbitrage',
    ): boolean {
        return this.calculateNetProfit(grossProfitEth, txType) > 0;
    }
}

export default GasOptimizer;
