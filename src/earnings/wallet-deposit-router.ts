// wallet-deposit-router.ts
// Routes profits automatically to specified wallet addresses

import { ethers } from 'ethers';
import logger from '../utils/logger';

export interface DepositRoute {
    chain: 'eth' | 'sol';
    destinationAddress: string;
    amountWei?: string; // ETH amount in wei
    amountLamports?: number; // Solana amount in lamports
    thresholdEth?: number; // Minimum ETH profit before routing
    thresholdSol?: number; // Minimum SOL profit before routing
}

export interface DepositResult {
    success: boolean;
    chain: string;
    destinationAddress: string;
    txHash?: string;
    error?: string;
}

class WalletDepositRouter {
    private provider: ethers.providers.JsonRpcProvider | null;
    private wallet: ethers.Wallet | null;
    private defaultEthDestination: string;
    private defaultSolDestination: string;

    constructor() {
        const rpcUrl = process.env.RPC_URL_1 || '';
        const privateKey = process.env.WALLET_PRIVATE_KEY || '';

        this.defaultEthDestination =
            process.env.ETH_PROFIT_DESTINATION ||
            process.env.WALLET_ADDRESS ||
            '0x08143f357d31Ec0D38B40eB383fC3450410c5CC7';

        this.defaultSolDestination =
            process.env.SOL_PROFIT_DESTINATION ||
            'D1DYRrJqfuTnuTszWtv3nHChCcanGm7Q1eF2GUUQ2r3';

        if (rpcUrl && privateKey) {
            this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
            this.wallet = new ethers.Wallet(privateKey, this.provider);
            logger.log('WalletDepositRouter: ETH wallet initialised');
        } else {
            this.provider = null;
            this.wallet = null;
            logger.warn('WalletDepositRouter: RPC_URL_1 or WALLET_PRIVATE_KEY not set – ETH routing disabled');
        }
    }

    async routeEthProfit(amountEth: number, destinationAddress?: string): Promise<DepositResult> {
        const destination = destinationAddress || this.defaultEthDestination;

        if (!this.wallet || !this.provider) {
            return {
                success: false,
                chain: 'eth',
                destinationAddress: destination,
                error: 'ETH wallet not initialised',
            };
        }

        try {
            const amountWei = ethers.utils.parseEther(amountEth.toFixed(18));
            logger.log(`Routing ${amountEth} ETH to ${destination}`);

            const tx = await this.wallet.sendTransaction({
                to: destination,
                value: amountWei,
            });

            await tx.wait();
            logger.log(`ETH deposit confirmed: ${tx.hash}`);

            return {
                success: true,
                chain: 'eth',
                destinationAddress: destination,
                txHash: tx.hash,
            };
        } catch (error) {
            logger.error(`ETH deposit failed: ${error}`);
            return {
                success: false,
                chain: 'eth',
                destinationAddress: destination,
                error: String(error),
            };
        }
    }

    // Solana transfers require @solana/web3.js – this is a template showing the structure.
    async routeSolProfit(amountSol: number, destinationAddress?: string): Promise<DepositResult> {
        const destination = destinationAddress || this.defaultSolDestination;
        logger.log(`Routing ${amountSol} SOL to ${destination} (requires @solana/web3.js)`);

        // Template: integrate @solana/web3.js Connection + Keypair + SystemProgram.transfer
        return {
            success: false,
            chain: 'sol',
            destinationAddress: destination,
            error: 'Solana routing not yet implemented – add @solana/web3.js dependency',
        };
    }

    async routeProfit(
        chain: 'eth' | 'sol',
        amount: number,
        threshold: number,
        destinationAddress?: string
    ): Promise<DepositResult | null> {
        if (amount < threshold) {
            logger.log(
                `Profit ${amount} on ${chain.toUpperCase()} is below threshold ${threshold} – skipping deposit`
            );
            return null;
        }

        if (chain === 'eth') {
            return this.routeEthProfit(amount, destinationAddress);
        }
        return this.routeSolProfit(amount, destinationAddress);
    }
}

export default WalletDepositRouter;
