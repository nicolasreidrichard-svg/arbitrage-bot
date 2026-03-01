// earnings-calculator.ts
// Calculates net profits after gas fees using arbitrage profit formulas

import logger from '../utils/logger';
import { EthTransaction, SolTransaction } from './earnings-fetcher';

// Constants
const WEI_PER_ETH = 1e18;
const LAMPORTS_PER_SOL = 1e9;
const GWEI_PER_ETH = 1e9;

export interface EthProfit {
    grossValueEth: number;
    totalGasCostEth: number;
    netProfitEth: number;
    transactionCount: number;
}

export interface SolProfit {
    grossValueSol: number;
    totalFeeSol: number;
    netProfitSol: number;
    transactionCount: number;
}

export interface CrossExchangeOpportunity {
    type: 'cross-exchange';
    exchangeA: string;
    exchangeB: string;
    rateAtoB: number;
    rateBtoA: number;
    profit: number; // rateAtoB * rateBtoA - 1
}

export interface TriangularOpportunity {
    type: 'triangular';
    exchangeA: string;
    exchangeB: string;
    exchangeC: string;
    rateAtoB: number;
    rateBtoC: number;
    rateCtoA: number;
    profit: number; // rateAtoB * rateBtoC * rateCtoA - 1
}

export type ArbitrageOpportunity = CrossExchangeOpportunity | TriangularOpportunity;

export interface EarningsSummary {
    eth: EthProfit;
    sol: SolProfit;
    calculatedAt: Date;
}

class EarningsCalculator {
    // Cross-exchange profit formula: rateAtoB × rateBtoA - 1
    calculateCrossExchangeProfit(rateAtoB: number, rateBtoA: number): number {
        return rateAtoB * rateBtoA - 1;
    }

    // Triangular arbitrage profit formula: rateAtoB × rateBtoC × rateCtoA - 1
    calculateTriangularProfit(rateAtoB: number, rateBtoC: number, rateCtoA: number): number {
        return rateAtoB * rateBtoC * rateCtoA - 1;
    }

    calculateEthProfits(transactions: EthTransaction[]): EthProfit {
        if (transactions.length === 0) {
            return { grossValueEth: 0, totalGasCostEth: 0, netProfitEth: 0, transactionCount: 0 };
        }

        let grossValueWei = 0;
        let totalGasCostWei = 0;
        let successfulCount = 0;

        for (const tx of transactions) {
            if (tx.isError === '0') {
                grossValueWei += parseFloat(tx.value);
                const gasCost = parseFloat(tx.gasUsed) * parseFloat(tx.gasPrice);
                totalGasCostWei += gasCost;
                successfulCount++;
            }
        }

        const grossValueEth = grossValueWei / WEI_PER_ETH;
        const totalGasCostEth = totalGasCostWei / WEI_PER_ETH;
        const netProfitEth = grossValueEth - totalGasCostEth;

        logger.log(
            `ETH profits: gross=${grossValueEth.toFixed(6)} ETH, gas=${totalGasCostEth.toFixed(6)} ETH, net=${netProfitEth.toFixed(6)} ETH`
        );

        return {
            grossValueEth,
            totalGasCostEth,
            netProfitEth,
            transactionCount: successfulCount,
        };
    }

    calculateSolProfits(transactions: SolTransaction[]): SolProfit {
        if (transactions.length === 0) {
            return { grossValueSol: 0, totalFeeSol: 0, netProfitSol: 0, transactionCount: 0 };
        }

        let grossValueLamports = 0;
        let totalFeeLamports = 0;
        let successfulCount = 0;

        for (const tx of transactions) {
            if (tx.status === 'Success') {
                grossValueLamports += tx.lamport || 0;
                totalFeeLamports += tx.fee || 0;
                successfulCount++;
            }
        }

        const grossValueSol = grossValueLamports / LAMPORTS_PER_SOL;
        const totalFeeSol = totalFeeLamports / LAMPORTS_PER_SOL;
        const netProfitSol = grossValueSol - totalFeeSol;

        logger.log(
            `SOL profits: gross=${grossValueSol.toFixed(6)} SOL, fees=${totalFeeSol.toFixed(6)} SOL, net=${netProfitSol.toFixed(6)} SOL`
        );

        return {
            grossValueSol,
            totalFeeSol,
            netProfitSol,
            transactionCount: successfulCount,
        };
    }

    // Estimate gas cost in ETH for a planned transaction
    estimateGasCostEth(gasLimit: number, gasPriceGwei: number): number {
        return (gasLimit * gasPriceGwei) / GWEI_PER_ETH;
    }

    // Determine if a cross-exchange opportunity is profitable after gas costs
    isCrossExchangeProfitable(
        rateAtoB: number,
        rateBtoA: number,
        tradeAmountEth: number,
        gasCostEth: number
    ): boolean {
        const profitRatio = this.calculateCrossExchangeProfit(rateAtoB, rateBtoA);
        const grossProfitEth = tradeAmountEth * profitRatio;
        return grossProfitEth > gasCostEth;
    }

    calculateEarningsSummary(
        ethTransactions: EthTransaction[],
        solTransactions: SolTransaction[]
    ): EarningsSummary {
        return {
            eth: this.calculateEthProfits(ethTransactions),
            sol: this.calculateSolProfits(solTransactions),
            calculatedAt: new Date(),
        };
    }
}

export default EarningsCalculator;
