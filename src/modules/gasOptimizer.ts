// src/modules/gasOptimizer.ts
// Gas Optimization Module – estimates gas costs and calculates net profit after fees.
// Wraps GasOptimizerEnhanced and adds batch-transaction and profitability helpers.

import GasOptimizerEnhanced, {
    EthGasEstimate,
    GasPriority,
} from '../integrations/gas-optimizer-enhanced';
import logger from '../utils/logger';

export { GasPriority };

export interface GasEstimate {
    standard: number;   // gwei
    fast: number;       // gwei
    instant: number;    // gwei
    baseFee: number;    // gwei (EIP-1559)
    source: string;
    timestamp: Date;
}

export interface TransactionGasCost {
    gasLimit: number;
    gasPriceGwei: number;
    costEth: number;
}

export interface NetProfitResult {
    grossProfitEth: number;
    gasCostEth: number;
    netProfitEth: number;
    isProfitable: boolean;
}

// Standard gas limits for common transaction types
export const GAS_LIMITS: Record<string, number> = {
    transfer: 21_000,
    erc20Transfer: 65_000,
    uniswapSwap: 150_000,
    uniswapV3Swap: 180_000,
    arbitrageTrade: 300_000,
    batchArbitrage: 450_000,
};

class GasOptimizer {
    private enhanced: GasOptimizerEnhanced;
    private cachedEstimate: EthGasEstimate | null = null;
    private cacheExpiresAt = 0;
    private readonly cacheTtlMs: number;

    constructor(cacheTtlMs = 30_000) {
        this.enhanced = new GasOptimizerEnhanced();
        this.cacheTtlMs = cacheTtlMs;
    }

    // Fetch (or return cached) ETH gas estimate and normalise to GasEstimate
    async getGasEstimate(priority: GasPriority = 'standard'): Promise<GasEstimate> {
        if (!this.cachedEstimate || Date.now() > this.cacheExpiresAt) {
            this.cachedEstimate = await this.enhanced.getEthGasEstimate();
            this.cacheExpiresAt = Date.now() + this.cacheTtlMs;
        }
        const e = this.cachedEstimate;
        return {
            standard: e.standard,
            fast: e.fast,
            instant: e.fastest,
            baseFee: e.baseFee,
            source: e.source,
            timestamp: e.timestamp,
        };
    }

    // Estimate the gas cost in ETH for a named transaction type
    async estimateGasCostForTransaction(
        txType: string,
        priority: GasPriority = 'standard'
    ): Promise<TransactionGasCost> {
        const gasLimit = GAS_LIMITS[txType] ?? GAS_LIMITS['arbitrageTrade'];
        const estimate = await this.getGasEstimate(priority);

        const gasPriceGwei =
            priority === 'fast'
                ? estimate.fast
                : priority === 'slow'
                ? estimate.standard * 0.8
                : estimate.standard;

        const costEth = this.enhanced.estimateEthTransactionCost(gasPriceGwei, gasLimit);

        logger.log(
            `Gas estimate for ${txType} (${priority}): ${gasLimit} gas @ ${gasPriceGwei} gwei = ${costEth.toFixed(6)} ETH`
        );

        return { gasLimit, gasPriceGwei, costEth };
    }

    // Calculate net profit after subtracting gas costs
    calculateNetProfit(grossProfitEth: number, gasCostEth: number): NetProfitResult {
        const netProfitEth = grossProfitEth - gasCostEth;
        return {
            grossProfitEth,
            gasCostEth,
            netProfitEth,
            isProfitable: netProfitEth > 0,
        };
    }

    // Check whether the network is congested (fast price > 2x standard)
    async isNetworkCongested(): Promise<boolean> {
        const estimate = await this.getGasEstimate();
        const congested = estimate.fast > estimate.standard * 2;
        if (congested) {
            logger.warn(
                `Network congestion detected: fast=${estimate.fast} gwei vs standard=${estimate.standard} gwei`
            );
        }
        return congested;
    }

    // Estimate cost savings for batching multiple transactions
    estimateBatchSavings(
        individualTxCount: number,
        gasPriceGwei: number
    ): { individualCostEth: number; batchCostEth: number; savingsEth: number } {
        const individualCostEth = this.enhanced.estimateEthTransactionCost(
            gasPriceGwei,
            GAS_LIMITS['arbitrageTrade'] * individualTxCount
        );
        const batchCostEth = this.enhanced.estimateEthTransactionCost(
            gasPriceGwei,
            GAS_LIMITS['batchArbitrage']
        );
        const savingsEth = individualCostEth - batchCostEth;

        logger.log(
            `Batch savings for ${individualTxCount} txs @ ${gasPriceGwei} gwei: ${savingsEth.toFixed(6)} ETH`
        );

        return { individualCostEth, batchCostEth, savingsEth };
    }
}

export default GasOptimizer;
