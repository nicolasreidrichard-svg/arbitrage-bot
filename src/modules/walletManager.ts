// src/modules/walletManager.ts

import { ethers } from 'ethers';
import { Wallet } from '../types';
import logger from '../utils/logger';

export interface TransactionRequest {
    to: string;
    value: string; // in ETH (e.g. "0.01")
    data?: string;
    gasLimit?: number;
    gasPrice?: number; // in Gwei
}

export interface TransactionReceipt {
    hash: string;
    status: 'pending' | 'confirmed' | 'failed';
    blockNumber?: number;
}

class WalletManager {
    private wallet: ethers.Wallet;
    private provider: ethers.providers.JsonRpcProvider | null = null;
    private pendingTransactions: Map<string, TransactionReceipt> = new Map();

    /**
     * Load a wallet from a private key.
     * @param privateKey - hex private key (with or without 0x prefix)
     * @param rpcUrl - optional JSON-RPC URL to connect the wallet to a provider
     */
    constructor(privateKey: string, rpcUrl?: string) {
        if (!privateKey || typeof privateKey !== 'string') {
            throw new Error('privateKey must be a non-empty string');
        }
        try {
            if (rpcUrl) {
                this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
                this.wallet = new ethers.Wallet(privateKey, this.provider);
            } else {
                this.wallet = new ethers.Wallet(privateKey);
            }
            logger.log(`Wallet loaded: ${this.wallet.address}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error loading wallet';
            logger.error(`Failed to load wallet: ${message}`);
            throw new Error(`Failed to load wallet: ${message}`);
        }
    }

    /**
     * Get the wallet's Ethereum address.
     */
    getAddress(): string {
        return this.wallet.address;
    }

    /**
     * Get wallet info (address and balances) suitable for the Wallet interface.
     * @param symbols - optional map of symbol -> ERC-20 contract addresses to check
     */
    async getWalletInfo(symbols?: Record<string, string>): Promise<Wallet> {
        const balance: { [symbol: string]: number } = {};

        if (this.provider) {
            try {
                const ethBalance = await this.wallet.getBalance();
                balance['ETH'] = parseFloat(ethers.utils.formatEther(ethBalance));
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                logger.error(`Failed to fetch ETH balance: ${message}`);
                balance['ETH'] = 0;
            }

            if (symbols) {
                for (const [symbol, _contractAddress] of Object.entries(symbols)) {
                    // ERC-20 balance fetching would be implemented here with a full ABI
                    // For now, we record 0 as a placeholder
                    balance[symbol] = 0;
                }
            }
        }

        return { address: this.wallet.address, balance };
    }

    /**
     * Sign and broadcast a transaction.
     */
    async sendTransaction(txRequest: TransactionRequest): Promise<TransactionReceipt> {
        if (!this.provider) {
            throw new Error('No provider configured — supply an rpcUrl to the constructor');
        }
        if (!txRequest.to || !ethers.utils.isAddress(txRequest.to)) {
            throw new Error('Invalid recipient address');
        }

        try {
            const tx = await this.wallet.sendTransaction({
                to: txRequest.to,
                value: ethers.utils.parseEther(txRequest.value),
                data: txRequest.data,
                gasLimit: txRequest.gasLimit,
                gasPrice: txRequest.gasPrice
                    ? ethers.utils.parseUnits(String(txRequest.gasPrice), 'gwei')
                    : undefined
            });

            const receipt: TransactionReceipt = { hash: tx.hash, status: 'pending' };
            this.pendingTransactions.set(tx.hash, receipt);
            logger.log(`Transaction broadcast: ${tx.hash}`);
            return receipt;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error(`Transaction failed: ${message}`);
            throw new Error(`Transaction failed: ${message}`);
        }
    }

    /**
     * Wait for a transaction to be confirmed.
     */
    async waitForConfirmation(txHash: string, confirmations = 1): Promise<TransactionReceipt> {
        if (!this.provider) {
            throw new Error('No provider configured');
        }
        try {
            const receipt = await this.provider.waitForTransaction(txHash, confirmations);
            const result: TransactionReceipt = {
                hash: txHash,
                status: receipt.status === 1 ? 'confirmed' : 'failed',
                blockNumber: receipt.blockNumber
            };
            this.pendingTransactions.set(txHash, result);
            logger.log(`Transaction ${txHash} ${result.status} in block ${result.blockNumber}`);
            return result;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error(`Failed to confirm transaction ${txHash}: ${message}`);
            throw new Error(`Failed to confirm transaction: ${message}`);
        }
    }

    /**
     * Get all pending transactions.
     */
    getPendingTransactions(): TransactionReceipt[] {
        return Array.from(this.pendingTransactions.values()).filter((t) => t.status === 'pending');
    }
}

export default WalletManager;
