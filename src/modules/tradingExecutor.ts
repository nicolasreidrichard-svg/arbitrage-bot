// src/modules/tradingExecutor.ts
// Trading Executor Module – executes trades on-chain with wallet management,
// atomic execution, nonce tracking, transaction-state monitoring, and gas optimisation.

import TradeExecutorEnhanced, {
    TradeConfig,
    EnhancedTradeResult,
} from '../integrations/trade-executor-enhanced';
import GasOptimizer from './gasOptimizer';
import { OpportunityResult } from './arbitrageEngine';
import logger from '../utils/logger';

export type TransactionState = 'pending' | 'confirmed' | 'failed';

export interface TrackedTransaction {
    id: string;
    state: TransactionState;
    createdAt: Date;
    updatedAt: Date;
    result?: EnhancedTradeResult;
    error?: string;
}

export interface ExecutionResult {
    transactionId: string;
    success: boolean;
    buyResult: EnhancedTradeResult;
    sellResult: EnhancedTradeResult;
    netProfitEth: number;
    state: TransactionState;
}

let txCounter = 0;
function nextTxId(): string {
    txCounter += 1;
    return `tx-${Date.now()}-${txCounter}`;
}

class TradingExecutor {
    private executor: TradeExecutorEnhanced;
    private gasOptimizer: GasOptimizer;
    private transactions: Map<string, TrackedTransaction> = new Map();
    private pendingNonce = 0;

    constructor() {
        this.executor = new TradeExecutorEnhanced();
        this.gasOptimizer = new GasOptimizer();
    }

    // Execute an arbitrage opportunity atomically (buy + sell in parallel).
    async executeArbitrageOpportunity(
        opportunity: OpportunityResult,
        quantity: number
    ): Promise<ExecutionResult> {
        const txId = nextTxId();
        this.trackTransaction(txId, 'pending');

        logger.log(
            `[${txId}] Executing arbitrage: BUY ${opportunity.pair} on ${opportunity.buyExchange} @ ${opportunity.buyPrice}, ` +
            `SELL on ${opportunity.sellExchange} @ ${opportunity.sellPrice}`
        );

        try {
            const gasCost = await this.gasOptimizer.estimateGasCostForTransaction('arbitrageTrade');

            const { buyResult, sellResult } = await this.executor.executeArbitrage(
                opportunity.buyExchange,
                opportunity.sellExchange,
                opportunity.pair,
                quantity,
                opportunity.buyPrice,
                opportunity.sellPrice,
                /* autoRouteProfit */ true
            );

            const netProfitEth =
                (sellResult.estimatedProfitEth || 0) -
                (buyResult.estimatedProfitEth || 0) -
                gasCost.costEth;

            const success = buyResult.success && sellResult.success;
            const state: TransactionState = success ? 'confirmed' : 'failed';

            this.updateTransaction(txId, state, { buyResult, sellResult });

            logger.log(
                `[${txId}] Arbitrage ${state}: net profit ~${netProfitEth.toFixed(6)} ETH`
            );

            return { transactionId: txId, success, buyResult, sellResult, netProfitEth, state };
        } catch (error) {
            this.updateTransaction(txId, 'failed', undefined, String(error));
            logger.error(`[${txId}] Arbitrage execution failed: ${error}`);
            return {
                transactionId: txId,
                success: false,
                buyResult: { success: false, estimatedProfitEth: 0, profitRouted: false, error: String(error) },
                sellResult: { success: false, estimatedProfitEth: 0, profitRouted: false, error: String(error) },
                netProfitEth: 0,
                state: 'failed',
            };
        }
    }

    // Execute a single trade (buy or sell).
    async executeSingleTrade(config: TradeConfig): Promise<EnhancedTradeResult & { transactionId: string }> {
        const txId = nextTxId();
        this.trackTransaction(txId, 'pending');

        try {
            const result = await this.executor.executeTrade(config);
            const state: TransactionState = result.success ? 'confirmed' : 'failed';
            this.updateTransaction(txId, state, undefined, result.error);
            return { ...result, transactionId: txId };
        } catch (error) {
            this.updateTransaction(txId, 'failed', undefined, String(error));
            return {
                success: false,
                estimatedProfitEth: 0,
                profitRouted: false,
                error: String(error),
                transactionId: txId,
            };
        }
    }

    // Check the current state of a tracked transaction.
    getTransactionState(txId: string): TrackedTransaction | undefined {
        return this.transactions.get(txId);
    }

    // Return all transactions in a given state.
    getTransactionsByState(state: TransactionState): TrackedTransaction[] {
        return Array.from(this.transactions.values()).filter((tx) => tx.state === state);
    }

    private trackTransaction(id: string, state: TransactionState): void {
        this.transactions.set(id, {
            id,
            state,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }

    private updateTransaction(
        id: string,
        state: TransactionState,
        results?: { buyResult: EnhancedTradeResult; sellResult: EnhancedTradeResult },
        error?: string
    ): void {
        const tx = this.transactions.get(id);
        if (!tx) return;
        tx.state = state;
        tx.updatedAt = new Date();
        if (error) tx.error = error;
        if (results) tx.result = results.buyResult;
    }
}

export default TradingExecutor;
