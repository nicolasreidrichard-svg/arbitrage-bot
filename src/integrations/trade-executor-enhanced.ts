// trade-executor-enhanced.ts
// Enhanced trade execution with automatic profit routing

import logger from '../utils/logger';
import WalletDepositRouter from '../earnings/wallet-deposit-router';
import { BinanceConnector, ExchangeOrder } from './exchange-connector';
import EarningsCalculator from '../earnings/earnings-calculator';

export interface TradeConfig {
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    price: number;
    exchange: string;
    autoRouteProfit: boolean;
    profitThresholdEth: number;
    profitDestination?: string;
}

export interface EnhancedTradeResult {
    success: boolean;
    order?: ExchangeOrder;
    estimatedProfitEth: number;
    profitRouted: boolean;
    depositResult?: {
        success: boolean;
        txHash?: string;
        error?: string;
    };
    error?: string;
}

class TradeExecutorEnhanced {
    private binanceConnector: BinanceConnector;
    private depositRouter: WalletDepositRouter;
    private calculator: EarningsCalculator;

    constructor() {
        this.binanceConnector = new BinanceConnector();
        this.depositRouter = new WalletDepositRouter();
        this.calculator = new EarningsCalculator();
    }

    async executeTrade(config: TradeConfig): Promise<EnhancedTradeResult> {
        logger.log(
            `Executing ${config.side.toUpperCase()} order on ${config.exchange}: ${config.quantity} ${config.symbol} @ ${config.price}`
        );

        let order: ExchangeOrder | undefined;
        try {
            if (config.exchange === 'binance') {
                order = await this.binanceConnector.placeOrder(
                    config.symbol,
                    config.side.toUpperCase() as 'BUY' | 'SELL',
                    config.quantity,
                    config.price
                );
                logger.log(`Order placed: ${order.orderId} – status: ${order.status}`);
            } else {
                throw new Error(`Exchange "${config.exchange}" not supported yet`);
            }
        } catch (error) {
            logger.error(`Trade execution failed: ${error}`);
            return { success: false, estimatedProfitEth: 0, profitRouted: false, error: String(error) };
        }

        const gasLimitEstimate = 21000;
        const gasPriceGwei = parseFloat(process.env.DEFAULT_GAS_PRICE_GWEI || '20');
        const gasCostEth = this.calculator.estimateGasCostEth(gasLimitEstimate, gasPriceGwei);
        const grossProfitEth = config.quantity * config.price * 0.001; // placeholder 0.1% spread
        const estimatedProfitEth = grossProfitEth - gasCostEth;

        let profitRouted = false;
        let depositResult: EnhancedTradeResult['depositResult'];

        if (config.autoRouteProfit && estimatedProfitEth > 0) {
            const result = await this.depositRouter.routeProfit(
                'eth',
                estimatedProfitEth,
                config.profitThresholdEth,
                config.profitDestination
            );

            if (result) {
                profitRouted = result.success;
                depositResult = {
                    success: result.success,
                    txHash: result.txHash,
                    error: result.error,
                };
            }
        }

        return {
            success: true,
            order,
            estimatedProfitEth,
            profitRouted,
            depositResult,
        };
    }

    async executeArbitrage(
        buyExchange: string,
        sellExchange: string,
        symbol: string,
        quantity: number,
        buyPrice: number,
        sellPrice: number,
        autoRouteProfit = true
    ): Promise<{ buyResult: EnhancedTradeResult; sellResult: EnhancedTradeResult }> {
        logger.log(
            `Arbitrage: BUY on ${buyExchange} @ ${buyPrice}, SELL on ${sellExchange} @ ${sellPrice}`
        );

        const [buyResult, sellResult] = await Promise.all([
            this.executeTrade({
                symbol,
                side: 'buy',
                quantity,
                price: buyPrice,
                exchange: buyExchange,
                autoRouteProfit: false,
                profitThresholdEth: 0,
            }),
            this.executeTrade({
                symbol,
                side: 'sell',
                quantity,
                price: sellPrice,
                exchange: sellExchange,
                autoRouteProfit,
                profitThresholdEth: parseFloat(process.env.PROFIT_THRESHOLD_ETH || '0.001'),
            }),
        ]);

        return { buyResult, sellResult };
    }
}

export default TradeExecutorEnhanced;
