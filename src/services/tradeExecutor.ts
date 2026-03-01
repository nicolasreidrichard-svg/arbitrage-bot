// src/services/tradeExecutor.ts

import { TradeResult, Price } from '../types';
import logger from '../utils/logger';

export interface TradeDetails {
    symbol: string;
    quantity: number;
    price: number;
    exchange: string;
}

export interface GasOptions {
    gasPrice: number;
    gasLimit: number;
}

class TradeExecutor {
    private pendingTrades: TradeDetails[] = [];

    executeTrade(tradeDetails: TradeDetails): TradeResult {
        if (!tradeDetails || !tradeDetails.symbol || tradeDetails.quantity <= 0 || tradeDetails.price <= 0) {
            const msg = 'Invalid trade details provided';
            logger.error(msg);
            throw new Error(msg);
        }

        try {
            logger.log(`Executing trade: ${JSON.stringify(tradeDetails)}`);
            this.pendingTrades.push(tradeDetails);

            const executedPrice: Price = {
                symbol: tradeDetails.symbol,
                value: tradeDetails.price,
                timestamp: new Date()
            };

            return {
                success: true,
                message: `Trade executed successfully for ${tradeDetails.symbol}`,
                executedPrice
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error during trade execution';
            logger.error(`Trade execution failed: ${message}`);
            throw new Error(`Trade execution failed: ${message}`);
        }
    }

    optimizeGasPrices(options?: Partial<GasOptions>): GasOptions {
        try {
            const baseGasPrice = options?.gasPrice ?? 20;
            const baseGasLimit = options?.gasLimit ?? 21000;
            const optimized: GasOptions = {
                gasPrice: Math.max(1, baseGasPrice),
                gasLimit: Math.max(21000, baseGasLimit)
            };
            logger.log(`Optimized gas: price=${optimized.gasPrice}, limit=${optimized.gasLimit}`);
            return optimized;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error during gas optimization';
            logger.error(`Gas optimization failed: ${message}`);
            throw new Error(`Gas optimization failed: ${message}`);
        }
    }

    logTransaction(transactionDetails: Record<string, unknown>): void {
        if (!transactionDetails || typeof transactionDetails !== 'object') {
            throw new Error('transactionDetails must be a non-null object');
        }
        logger.log(`Transaction logged: ${JSON.stringify(transactionDetails)}`);
    }

    getPendingTrades(): TradeDetails[] {
        return [...this.pendingTrades];
    }

    clearPendingTrades(): void {
        this.pendingTrades = [];
    }
}

export default TradeExecutor;

