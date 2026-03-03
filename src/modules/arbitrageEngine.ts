// src/modules/arbitrageEngine.ts
// Arbitrage Engine – detects cross-exchange and triangular arbitrage opportunities,
// accounts for gas costs and slippage, and returns a ranked list of opportunities.

import MarketDataFetcher, { NormalizedPrice, MarketSnapshot } from './marketDataFetcher';
import GasOptimizer from './gasOptimizer';
import logger from '../utils/logger';

export interface OpportunityResult {
    type: 'cross-exchange' | 'triangular';
    pair: string;
    buyExchange: string;
    sellExchange: string;
    buyPrice: number;
    sellPrice: number;
    grossProfitRatio: number;   // (sellPrice - buyPrice) / buyPrice
    estimatedGasCostEth: number;
    tradeAmountEth: number;
    grossProfitEth: number;
    netProfitEth: number;
    isProfitable: boolean;
    slippageEstimate: number;   // fraction, e.g. 0.005 = 0.5%
    detectedAt: Date;
}

export interface TriangularOpportunityResult {
    type: 'triangular';
    pairAB: string;
    pairBC: string;
    pairCA: string;
    exchangeA: string;
    exchangeB: string;
    exchangeC: string;
    rateAB: number;
    rateBC: number;
    rateCA: number;
    profitRatio: number;        // rateAB * rateBC * rateCA - 1
    estimatedGasCostEth: number;
    tradeAmountEth: number;
    netProfitEth: number;
    isProfitable: boolean;
    detectedAt: Date;
}

export type AnyOpportunity = OpportunityResult | TriangularOpportunityResult;

export interface ArbitrageConfig {
    minProfitThresholdEth: number;
    slippageTolerance: number;      // fraction, e.g. 0.005 = 0.5%
    defaultTradeAmountEth: number;
    gasPriority: 'slow' | 'standard' | 'fast';
}

const DEFAULT_CONFIG: ArbitrageConfig = {
    minProfitThresholdEth: parseFloat(process.env.PROFIT_THRESHOLD_ETH || '0.001'),
    slippageTolerance: 0.005,
    defaultTradeAmountEth: 1.0,
    gasPriority: (process.env.ETH_GAS_PRIORITY as ArbitrageConfig['gasPriority']) || 'standard',
};

class ArbitrageEngine {
    private fetcher: MarketDataFetcher;
    private gasOptimizer: GasOptimizer;
    private config: ArbitrageConfig;

    constructor(config: Partial<ArbitrageConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.fetcher = new MarketDataFetcher();
        this.gasOptimizer = new GasOptimizer();
    }

    // Scan a list of trading pairs and return all profitable opportunities.
    async findOpportunities(pairs: string[]): Promise<OpportunityResult[]> {
        logger.log(`Scanning ${pairs.length} trading pair(s) for arbitrage opportunities`);

        const snapshots = await this.fetcher.fetchMultiplePairs(pairs);
        const gasCost = await this.gasOptimizer.estimateGasCostForTransaction(
            'arbitrageTrade',
            this.config.gasPriority
        );

        const opportunities: OpportunityResult[] = [];
        for (const snapshot of snapshots) {
            const found = this.detectCrossExchangeOpportunities(snapshot, gasCost.costEth);
            opportunities.push(...found);
        }

        const profitable = opportunities
            .filter((o) => o.isProfitable && o.netProfitEth >= this.config.minProfitThresholdEth)
            .sort((a, b) => b.netProfitEth - a.netProfitEth);

        logger.log(
            `Found ${profitable.length} profitable opportunity(s) out of ${opportunities.length} candidate(s)`
        );

        return profitable;
    }

    // Detect cross-exchange opportunities within a market snapshot.
    detectCrossExchangeOpportunities(
        snapshot: MarketSnapshot,
        estimatedGasCostEth: number
    ): OpportunityResult[] {
        const { prices } = snapshot;
        if (prices.length < 2) return [];

        const opportunities: OpportunityResult[] = [];

        for (let i = 0; i < prices.length; i++) {
            for (let j = 0; j < prices.length; j++) {
                if (i === j) continue;

                const buyer = prices[i];   // buy here (at ask price)
                const seller = prices[j];  // sell here (at bid price)

                const buyPrice = buyer.ask * (1 + this.config.slippageTolerance);
                const sellPrice = seller.bid * (1 - this.config.slippageTolerance);

                if (sellPrice <= buyPrice) continue;

                const grossProfitRatio = (sellPrice - buyPrice) / buyPrice;
                const tradeAmountEth = this.config.defaultTradeAmountEth;
                const grossProfitEth = tradeAmountEth * grossProfitRatio;
                const netProfitEth = grossProfitEth - estimatedGasCostEth;

                opportunities.push({
                    type: 'cross-exchange',
                    pair: snapshot.pair,
                    buyExchange: buyer.exchange,
                    sellExchange: seller.exchange,
                    buyPrice,
                    sellPrice,
                    grossProfitRatio,
                    estimatedGasCostEth,
                    tradeAmountEth,
                    grossProfitEth,
                    netProfitEth,
                    isProfitable: netProfitEth > 0,
                    slippageEstimate: this.config.slippageTolerance,
                    detectedAt: new Date(),
                });
            }
        }

        return opportunities;
    }

    // Detect triangular arbitrage across three price feeds.
    detectTriangularOpportunity(
        priceAB: NormalizedPrice,
        priceBC: NormalizedPrice,
        priceCA: NormalizedPrice,
        estimatedGasCostEth: number
    ): TriangularOpportunityResult {
        const slip = this.config.slippageTolerance;
        const rateAB = priceAB.bid * (1 - slip);
        const rateBC = priceBC.bid * (1 - slip);
        const rateCA = priceCA.bid * (1 - slip);

        const profitRatio = rateAB * rateBC * rateCA - 1;
        const tradeAmountEth = this.config.defaultTradeAmountEth;
        const grossProfitEth = tradeAmountEth * Math.max(0, profitRatio);
        const netProfitEth = grossProfitEth - estimatedGasCostEth;

        return {
            type: 'triangular',
            pairAB: priceAB.pair,
            pairBC: priceBC.pair,
            pairCA: priceCA.pair,
            exchangeA: priceAB.exchange,
            exchangeB: priceBC.exchange,
            exchangeC: priceCA.exchange,
            rateAB,
            rateBC,
            rateCA,
            profitRatio,
            estimatedGasCostEth,
            tradeAmountEth,
            netProfitEth,
            isProfitable: netProfitEth > 0,
            detectedAt: new Date(),
        };
    }
}

export default ArbitrageEngine;
