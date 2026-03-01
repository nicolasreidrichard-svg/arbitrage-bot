// health-check.ts
// Monitors system health and API connectivity

import axios from 'axios';
import logger from './logger';

export interface HealthStatus {
    service: string;
    status: 'ok' | 'degraded' | 'down';
    latencyMs?: number;
    error?: string;
}

export interface SystemHealth {
    overall: 'ok' | 'degraded' | 'down';
    services: HealthStatus[];
    checkedAt: Date;
}

class HealthCheck {
    async checkEtherscan(): Promise<HealthStatus> {
        const start = Date.now();
        try {
            const apiKey = process.env.ETHERSCAN_API_KEY;
            if (!apiKey) {
                return { service: 'etherscan', status: 'degraded', error: 'API key not configured' };
            }
            await axios.get('https://api.etherscan.io/api', {
                params: { module: 'stats', action: 'ethprice', apikey: apiKey },
                timeout: 5000,
            });
            return { service: 'etherscan', status: 'ok', latencyMs: Date.now() - start };
        } catch (error) {
            return { service: 'etherscan', status: 'down', error: String(error) };
        }
    }

    async checkSolscan(): Promise<HealthStatus> {
        const start = Date.now();
        try {
            const apiKey = process.env.SOLSCAN_API_KEY;
            if (!apiKey) {
                return { service: 'solscan', status: 'degraded', error: 'API key not configured' };
            }
            await axios.get('https://pro-api.solscan.io/v2.0/monitor/usage', {
                headers: { token: apiKey },
                timeout: 5000,
            });
            return { service: 'solscan', status: 'ok', latencyMs: Date.now() - start };
        } catch (error) {
            return { service: 'solscan', status: 'down', error: String(error) };
        }
    }

    async checkBinance(): Promise<HealthStatus> {
        const start = Date.now();
        try {
            await axios.get('https://api.binance.com/api/v3/ping', { timeout: 5000 });
            return { service: 'binance', status: 'ok', latencyMs: Date.now() - start };
        } catch (error) {
            return { service: 'binance', status: 'down', error: String(error) };
        }
    }

    async checkCoinbase(): Promise<HealthStatus> {
        const start = Date.now();
        try {
            await axios.get('https://api.exchange.coinbase.com/time', { timeout: 5000 });
            return { service: 'coinbase', status: 'ok', latencyMs: Date.now() - start };
        } catch (error) {
            return { service: 'coinbase', status: 'down', error: String(error) };
        }
    }

    async checkEthRpc(): Promise<HealthStatus> {
        const start = Date.now();
        const rpcUrl = process.env.RPC_URL_1;
        if (!rpcUrl) {
            return { service: 'eth-rpc', status: 'degraded', error: 'RPC_URL_1 not configured' };
        }
        try {
            await axios.post(rpcUrl, { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }, { timeout: 5000 });
            return { service: 'eth-rpc', status: 'ok', latencyMs: Date.now() - start };
        } catch (error) {
            return { service: 'eth-rpc', status: 'down', error: String(error) };
        }
    }

    async runAll(): Promise<SystemHealth> {
        logger.log('Running system health checks...');

        const results = await Promise.all([
            this.checkEtherscan(),
            this.checkSolscan(),
            this.checkBinance(),
            this.checkCoinbase(),
            this.checkEthRpc(),
        ]);

        const downCount = results.filter((r) => r.status === 'down').length;
        const degradedCount = results.filter((r) => r.status === 'degraded').length;

        let overall: SystemHealth['overall'] = 'ok';
        if (downCount > 0) overall = 'down';
        else if (degradedCount > 0) overall = 'degraded';

        const health: SystemHealth = {
            overall,
            services: results,
            checkedAt: new Date(),
        };

        this.printHealth(health);
        return health;
    }

    private printHealth(health: SystemHealth): void {
        logger.log(`System health: ${health.overall.toUpperCase()} (checked at ${health.checkedAt.toISOString()})`);
        for (const s of health.services) {
            const latency = s.latencyMs !== undefined ? ` (${s.latencyMs}ms)` : '';
            const err = s.error ? ` – ${s.error}` : '';
            logger.log(`  [${s.status.toUpperCase()}] ${s.service}${latency}${err}`);
        }
    }
}

export default HealthCheck;
