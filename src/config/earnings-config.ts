// earnings-config.ts
// Configuration for earnings tracking and profit thresholds

export interface EarningsConfig {
    eth: {
        address: string;
        profitDestination: string;
        profitThresholdEth: number;
        autoRoute: boolean;
    };
    sol: {
        address: string;
        profitDestination: string;
        profitThresholdSol: number;
        autoRoute: boolean;
    };
    reporting: {
        enabled: boolean;
        intervalMs: number;
        outputFormat: 'json' | 'text';
    };
    gasOptimization: {
        ethPriority: 'slow' | 'standard' | 'fast';
        solComputeUnits: number;
    };
}

const earningsConfig: EarningsConfig = {
    eth: {
        address:
            process.env.ETH_ADDRESS || '0x08143f357d31Ec0D38B40eB383fC3450410c5CC7',
        profitDestination:
            process.env.ETH_PROFIT_DESTINATION ||
            process.env.WALLET_ADDRESS ||
            '0x08143f357d31Ec0D38B40eB383fC3450410c5CC7',
        profitThresholdEth: parseFloat(process.env.PROFIT_THRESHOLD_ETH || '0.001'),
        autoRoute: process.env.AUTO_ROUTE_PROFITS === 'true',
    },
    sol: {
        address:
            process.env.SOL_ADDRESS || 'D1DYRrJqfuTnuTszWtv3nHChCcanGm7Q1eF2GUUQ2r3',
        profitDestination:
            process.env.SOL_PROFIT_DESTINATION ||
            'D1DYRrJqfuTnuTszWtv3nHChCcanGm7Q1eF2GUUQ2r3',
        profitThresholdSol: parseFloat(process.env.PROFIT_THRESHOLD_SOL || '0.01'),
        autoRoute: process.env.AUTO_ROUTE_PROFITS === 'true',
    },
    reporting: {
        enabled: process.env.EARNINGS_REPORTING_ENABLED !== 'false',
        intervalMs: parseInt(process.env.EARNINGS_REPORT_INTERVAL_MS || '3600000', 10), // 1 hour
        outputFormat: (process.env.EARNINGS_REPORT_FORMAT as 'json' | 'text') || 'text',
    },
    gasOptimization: {
        ethPriority: (process.env.ETH_GAS_PRIORITY as 'slow' | 'standard' | 'fast') || 'standard',
        solComputeUnits: parseInt(process.env.SOL_COMPUTE_UNITS || '200000', 10),
    },
};

export default earningsConfig;
