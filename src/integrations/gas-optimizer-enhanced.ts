// gas-optimizer-enhanced.ts
// Enhanced gas optimization for both ETH and Solana networks

import axios from 'axios';
import logger from '../utils/logger';

export interface EthGasEstimate {
    safeLow: number;       // gwei
    standard: number;      // gwei
    fast: number;          // gwei
    fastest: number;       // gwei
    baseFee: number;       // gwei (EIP-1559)
    suggestedMaxPriorityFee: number; // gwei (EIP-1559 tip)
    source: string;
    timestamp: Date;
}

export interface SolFeeEstimate {
    microLamportsPerComputeUnit: number;
    totalFeeEstimateLamports: number;
    priorityLevel: 'min' | 'low' | 'medium' | 'high' | 'veryHigh';
    timestamp: Date;
}

export type GasPriority = 'slow' | 'standard' | 'fast';

class GasOptimizerEnhanced {
    private etherscanApiKey: string;
    private heliusApiKey: string;
    private gasStationUrl: string;
    private heliusRpcUrl: string;

    constructor() {
        this.etherscanApiKey = process.env.ETHERSCAN_API_KEY || '';
        this.heliusApiKey = process.env.HELIUS_API_KEY || '';
        this.gasStationUrl = 'https://api.etherscan.io/api';
        this.heliusRpcUrl = this.heliusApiKey
            ? `https://mainnet.helius-rpc.com/?api-key=${this.heliusApiKey}`
            : '';
    }

    // ── ETH Gas ────────────────────────────────────────────────────────────

    async getEthGasEstimate(): Promise<EthGasEstimate> {
        if (!this.etherscanApiKey) {
            logger.warn('ETHERSCAN_API_KEY not set – returning default gas estimates');
            return this.defaultEthGasEstimate();
        }

        try {
            const response = await axios.get(this.gasStationUrl, {
                params: {
                    module: 'gastracker',
                    action: 'gasoracle',
                    apikey: this.etherscanApiKey,
                },
            });

            const data = response.data.result;
            const estimate: EthGasEstimate = {
                safeLow: parseFloat(data.SafeGasPrice),
                standard: parseFloat(data.ProposeGasPrice),
                fast: parseFloat(data.FastGasPrice),
                fastest: parseFloat(data.FastGasPrice) * 1.2,
                baseFee: parseFloat(data.suggestBaseFee || '0'),
                suggestedMaxPriorityFee: parseFloat(data.FastGasPrice) - parseFloat(data.suggestBaseFee || '0'),
                source: 'etherscan',
                timestamp: new Date(),
            };

            logger.log(
                `ETH gas: safe=${estimate.safeLow} / standard=${estimate.standard} / fast=${estimate.fast} gwei`
            );
            return estimate;
        } catch (error) {
            logger.error(`Error fetching ETH gas estimate: ${error}`);
            return this.defaultEthGasEstimate();
        }
    }

    private defaultEthGasEstimate(): EthGasEstimate {
        return {
            safeLow: 10,
            standard: 20,
            fast: 40,
            fastest: 60,
            baseFee: 15,
            suggestedMaxPriorityFee: 2,
            source: 'default',
            timestamp: new Date(),
        };
    }

    selectEthGasPrice(estimate: EthGasEstimate, priority: GasPriority): number {
        switch (priority) {
            case 'slow':
                return estimate.safeLow;
            case 'fast':
                return estimate.fast;
            case 'standard':
            default:
                return estimate.standard;
        }
    }

    // Calculate EIP-1559 transaction parameters
    calculateEip1559Params(
        estimate: EthGasEstimate,
        priority: GasPriority
    ): { maxFeePerGas: number; maxPriorityFeePerGas: number } {
        const tip = priority === 'fast' ? estimate.suggestedMaxPriorityFee * 2 : estimate.suggestedMaxPriorityFee;
        const maxFeePerGas = estimate.baseFee * 2 + tip;
        return { maxFeePerGas, maxPriorityFeePerGas: tip };
    }

    estimateEthTransactionCost(gasPriceGwei: number, gasLimit: number): number {
        return (gasPriceGwei * gasLimit) / 1e9; // in ETH
    }

    // ── Solana Fee ─────────────────────────────────────────────────────────

    async getSolFeeEstimate(computeUnits = 200_000): Promise<SolFeeEstimate> {
        if (!this.heliusRpcUrl) {
            logger.warn('HELIUS_API_KEY not set – returning default Solana fee estimate');
            return this.defaultSolFeeEstimate(computeUnits);
        }

        try {
            const response = await axios.post(this.heliusRpcUrl, {
                jsonrpc: '2.0',
                id: 1,
                method: 'getPriorityFeeEstimate',
                params: [
                    {
                        options: {
                            includeAllPriorityFeeLevels: true,
                        },
                    },
                ],
            });

            const levels = response.data.result?.priorityFeeLevels;
            const medium = levels?.medium || 1000;

            const estimate: SolFeeEstimate = {
                microLamportsPerComputeUnit: medium,
                totalFeeEstimateLamports: Math.ceil((medium * computeUnits) / 1_000_000),
                priorityLevel: 'medium',
                timestamp: new Date(),
            };

            logger.log(
                `Solana fee: ${estimate.microLamportsPerComputeUnit} micro-lamports/CU, total ~${estimate.totalFeeEstimateLamports} lamports`
            );
            return estimate;
        } catch (error) {
            logger.error(`Error fetching Solana fee estimate: ${error}`);
            return this.defaultSolFeeEstimate(computeUnits);
        }
    }

    private defaultSolFeeEstimate(computeUnits: number): SolFeeEstimate {
        const microLamportsPerCU = 1000;
        return {
            microLamportsPerComputeUnit: microLamportsPerCU,
            totalFeeEstimateLamports: Math.ceil((microLamportsPerCU * computeUnits) / 1_000_000),
            priorityLevel: 'medium',
            timestamp: new Date(),
        };
    }

    estimateSolTransactionCost(microLamportsPerCU: number, computeUnits: number): number {
        return (microLamportsPerCU * computeUnits) / 1_000_000 / 1e9; // in SOL (lamports -> SOL)
    }
}

export default GasOptimizerEnhanced;
