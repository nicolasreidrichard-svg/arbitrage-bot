// src/modules/gasOptimizer.ts

import { GasEstimate } from '../types';
import logger from '../utils/logger';

export type GasSpeed = 'standard' | 'fast' | 'instant';

export interface GasRecommendation {
    speed: GasSpeed;
    gasPrice: number;
    estimatedGas: number;
    estimatedCostEth: number;
}

export interface NetProfitResult {
    grossProfit: number;
    gasCostEth: number;
    netProfit: number;
    profitable: boolean;
}

// Speed multipliers relative to base gas price
const GAS_SPEED_MULTIPLIERS: Record<GasSpeed, number> = {
    standard: 1.0,
    fast: 1.2,
    instant: 1.5
};

class GasOptimizer {
    private baseGasPrice: number; // in Gwei
    private congestionFactor: number; // 1.0 = normal, >1 = congested

    constructor(baseGasPrice = 20, congestionFactor = 1.0) {
        if (baseGasPrice <= 0) {
            throw new Error('baseGasPrice must be positive');
        }
        if (congestionFactor <= 0) {
            throw new Error('congestionFactor must be positive');
        }
        this.baseGasPrice = baseGasPrice;
        this.congestionFactor = congestionFactor;
    }

    /**
     * Estimate gas cost for a transaction type.
     * @param gasLimit - estimated gas units for the transaction
     * @param speed - desired confirmation speed
     */
    estimateGas(gasLimit: number, speed: GasSpeed = 'standard'): GasEstimate {
        if (gasLimit <= 0) {
            throw new Error('gasLimit must be positive');
        }
        const multiplier = GAS_SPEED_MULTIPLIERS[speed];
        const gasPrice = this.baseGasPrice * this.congestionFactor * multiplier;
        logger.log(`Gas estimate — limit: ${gasLimit}, price: ${gasPrice} Gwei, speed: ${speed}`);
        return { estimatedGas: gasLimit, gasPrice };
    }

    /**
     * Recommend optimal gas price for all three speed tiers.
     * @param gasLimit - estimated gas units for the transaction
     */
    recommendGasOptions(gasLimit: number): GasRecommendation[] {
        if (gasLimit <= 0) {
            throw new Error('gasLimit must be positive');
        }
        const speeds: GasSpeed[] = ['standard', 'fast', 'instant'];
        return speeds.map((speed) => {
            const { gasPrice, estimatedGas } = this.estimateGas(gasLimit, speed);
            // 1 Gwei = 1e-9 ETH, gas cost = gasPrice (Gwei) * gasLimit / 1e9
            const estimatedCostEth = (gasPrice * estimatedGas) / 1e9;
            return { speed, gasPrice, estimatedGas, estimatedCostEth };
        });
    }

    /**
     * Calculate net profit after deducting gas costs.
     * @param grossProfitEth - gross arbitrage profit in ETH
     * @param gasLimit - gas units required for the transaction
     * @param speed - desired gas speed
     * @param ethPriceUsd - optional ETH price in USD for logging
     */
    calculateNetProfit(
        grossProfitEth: number,
        gasLimit: number,
        speed: GasSpeed = 'standard',
        ethPriceUsd?: number
    ): NetProfitResult {
        if (gasLimit <= 0) {
            throw new Error('gasLimit must be positive');
        }
        const { gasPrice, estimatedGas } = this.estimateGas(gasLimit, speed);
        const gasCostEth = (gasPrice * estimatedGas) / 1e9;
        const netProfit = grossProfitEth - gasCostEth;
        const profitable = netProfit > 0;

        const logMsg = ethPriceUsd
            ? `Net profit: ${netProfit.toFixed(8)} ETH (~$${(netProfit * ethPriceUsd).toFixed(2)} USD)`
            : `Net profit: ${netProfit.toFixed(8)} ETH`;
        logger.log(logMsg);

        return { grossProfit: grossProfitEth, gasCostEth, netProfit, profitable };
    }

    /**
     * Update the base gas price (e.g. after polling a gas price API).
     */
    updateBaseGasPrice(newBaseGasPrice: number): void {
        if (newBaseGasPrice <= 0) {
            throw new Error('newBaseGasPrice must be positive');
        }
        this.baseGasPrice = newBaseGasPrice;
        logger.log(`Base gas price updated to ${newBaseGasPrice} Gwei`);
    }

    /**
     * Update the network congestion factor.
     */
    updateCongestionFactor(factor: number): void {
        if (factor <= 0) {
            throw new Error('congestionFactor must be positive');
        }
        this.congestionFactor = factor;
        logger.log(`Congestion factor updated to ${factor}`);
    }

    getBaseGasPrice(): number {
        return this.baseGasPrice;
    }

    getCongestionFactor(): number {
        return this.congestionFactor;
    }
}

export default GasOptimizer;
