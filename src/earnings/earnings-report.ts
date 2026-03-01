// earnings-report.ts
// Generates consolidated earnings reports across ETH and Solana chains

import logger from '../utils/logger';
import EarningsFetcher from './earnings-fetcher';
import EarningsCalculator, { EarningsSummary } from './earnings-calculator';

export interface ConsolidatedReport {
    period: string;
    eth: {
        address: string;
        grossValueEth: number;
        totalGasCostEth: number;
        netProfitEth: number;
        transactionCount: number;
    };
    sol: {
        address: string;
        grossValueSol: number;
        totalFeeSol: number;
        netProfitSol: number;
        transactionCount: number;
    };
    totalTransactions: number;
    generatedAt: string;
}

class EarningsReport {
    private fetcher: EarningsFetcher;
    private calculator: EarningsCalculator;
    private ethAddress: string;
    private solAddress: string;

    constructor() {
        this.fetcher = new EarningsFetcher();
        this.calculator = new EarningsCalculator();
        this.ethAddress = process.env.ETH_ADDRESS || '0x08143f357d31Ec0D38B40eB383fC3450410c5CC7';
        this.solAddress = process.env.SOL_ADDRESS || 'D1DYRrJqfuTnuTszWtv3nHChCcanGm7Q1eF2GUUQ2r3';
    }

    async generateReport(period = 'all-time'): Promise<ConsolidatedReport> {
        logger.log(`Generating earnings report for period: ${period}`);

        const transactionData = await this.fetcher.fetchAllTransactions();
        const summary: EarningsSummary = this.calculator.calculateEarningsSummary(
            transactionData.eth,
            transactionData.sol
        );

        const report: ConsolidatedReport = {
            period,
            eth: {
                address: this.ethAddress,
                grossValueEth: summary.eth.grossValueEth,
                totalGasCostEth: summary.eth.totalGasCostEth,
                netProfitEth: summary.eth.netProfitEth,
                transactionCount: summary.eth.transactionCount,
            },
            sol: {
                address: this.solAddress,
                grossValueSol: summary.sol.grossValueSol,
                totalFeeSol: summary.sol.totalFeeSol,
                netProfitSol: summary.sol.netProfitSol,
                transactionCount: summary.sol.transactionCount,
            },
            totalTransactions: summary.eth.transactionCount + summary.sol.transactionCount,
            generatedAt: new Date().toISOString(),
        };

        this.printReport(report);
        return report;
    }

    private printReport(report: ConsolidatedReport): void {
        const separator = '='.repeat(60);
        const lines = [
            separator,
            `EARNINGS REPORT – Period: ${report.period}`,
            `Generated: ${report.generatedAt}`,
            separator,
            '',
            '[ ETH Chain ]',
            `  Address:          ${report.eth.address}`,
            `  Gross Value:      ${report.eth.grossValueEth.toFixed(6)} ETH`,
            `  Total Gas Cost:   ${report.eth.totalGasCostEth.toFixed(6)} ETH`,
            `  Net Profit:       ${report.eth.netProfitEth.toFixed(6)} ETH`,
            `  Transactions:     ${report.eth.transactionCount}`,
            '',
            '[ Solana Chain ]',
            `  Address:          ${report.sol.address}`,
            `  Gross Value:      ${report.sol.grossValueSol.toFixed(6)} SOL`,
            `  Total Fees:       ${report.sol.totalFeeSol.toFixed(6)} SOL`,
            `  Net Profit:       ${report.sol.netProfitSol.toFixed(6)} SOL`,
            `  Transactions:     ${report.sol.transactionCount}`,
            '',
            `Total Transactions: ${report.totalTransactions}`,
            separator,
        ];

        lines.forEach((line) => logger.log(line));
    }

    formatReportAsJson(report: ConsolidatedReport): string {
        return JSON.stringify(report, null, 2);
    }
}

export default EarningsReport;
