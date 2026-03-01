// earnings-fetcher.ts
// Fetches transaction data from Etherscan (ETH) and Solscan (Solana)

import axios from 'axios';
import logger from '../utils/logger';

// ETH address: 0x08143f357d31Ec0D38B40eB383fC3450410c5CC7
// Solana address: D1DYRrJqfuTnuTszWtv3nHChCcanGm7Q1eF2GUUQ2r3

export interface EthTransaction {
    hash: string;
    from: string;
    to: string;
    value: string;
    gasUsed: string;
    gasPrice: string;
    timeStamp: string;
    isError: string;
    blockNumber: string;
}

export interface SolTransaction {
    signature: string;
    slot: number;
    blockTime: number;
    status: string;
    fee: number;
    lamport: number;
    signer: string[];
}

export interface TransactionData {
    eth: EthTransaction[];
    sol: SolTransaction[];
    fetchedAt: Date;
}

class EarningsFetcher {
    private etherscanApiKey: string;
    private solscanApiKey: string;
    private ethAddress: string;
    private solAddress: string;
    private etherscanBaseUrl: string;
    private solscanBaseUrl: string;

    constructor() {
        this.etherscanApiKey = process.env.ETHERSCAN_API_KEY || '';
        this.solscanApiKey = process.env.SOLSCAN_API_KEY || '';
        this.ethAddress = process.env.ETH_ADDRESS || '0x08143f357d31Ec0D38B40eB383fC3450410c5CC7';
        this.solAddress = process.env.SOL_ADDRESS || 'D1DYRrJqfuTnuTszWtv3nHChCcanGm7Q1eF2GUUQ2r3';
        this.etherscanBaseUrl = 'https://api.etherscan.io/api';
        this.solscanBaseUrl = 'https://pro-api.solscan.io/v2.0';
    }

    async fetchEthTransactions(startBlock = 0, endBlock = 99999999): Promise<EthTransaction[]> {
        if (!this.etherscanApiKey) {
            logger.warn('ETHERSCAN_API_KEY not set – returning empty ETH transaction list');
            return [];
        }

        try {
            const params = {
                module: 'account',
                action: 'txlist',
                address: this.ethAddress,
                startblock: startBlock,
                endblock: endBlock,
                sort: 'desc',
                apikey: this.etherscanApiKey,
            };

            const response = await axios.get(this.etherscanBaseUrl, { params });

            if (response.data.status !== '1') {
                logger.warn(`Etherscan returned status ${response.data.status}: ${response.data.message}`);
                return [];
            }

            logger.log(`Fetched ${response.data.result.length} ETH transactions`);
            return response.data.result as EthTransaction[];
        } catch (error) {
            logger.error(`Error fetching ETH transactions: ${error}`);
            throw error;
        }
    }

    async fetchSolTransactions(limit = 50): Promise<SolTransaction[]> {
        if (!this.solscanApiKey) {
            logger.warn('SOLSCAN_API_KEY not set – returning empty Solana transaction list');
            return [];
        }

        try {
            const url = `${this.solscanBaseUrl}/account/transactions`;
            const response = await axios.get(url, {
                headers: { token: this.solscanApiKey },
                params: {
                    address: this.solAddress,
                    limit,
                },
            });

            const transactions: SolTransaction[] = response.data.data || [];
            logger.log(`Fetched ${transactions.length} Solana transactions`);
            return transactions;
        } catch (error) {
            logger.error(`Error fetching Solana transactions: ${error}`);
            throw error;
        }
    }

    async fetchAllTransactions(): Promise<TransactionData> {
        logger.log('Fetching transactions from Etherscan and Solscan...');

        const [eth, sol] = await Promise.all([
            this.fetchEthTransactions().catch(() => [] as EthTransaction[]),
            this.fetchSolTransactions().catch(() => [] as SolTransaction[]),
        ]);

        return {
            eth,
            sol,
            fetchedAt: new Date(),
        };
    }
}

export default EarningsFetcher;
