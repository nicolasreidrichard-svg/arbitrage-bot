// src/modules/tradingExecutor.ts
//
// Executes on-chain trades when profitable arbitrage opportunities are identified.
// Supports multi-hop DEX swaps, nonce management, gas optimisation, and transaction
// state tracking (pending → confirmed | failed).

import { ethers } from 'ethers';
import {
    GasEstimate,
    Opportunity,
    SwapStep,
    TradeResult,
    TradingExecutorConfig,
    TransactionRecord,
    TransactionState,
} from '../types';
import logger from '../utils/logger';

// Minimal Uniswap V2-style router ABI (swapExactTokensForTokens + getAmountsOut)
const DEX_ROUTER_ABI = [
    'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)',
    'function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts)',
];

// Minimal ERC-20 ABI for approval and balance checks
const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)',
];

class TradingExecutor {
    private readonly provider: ethers.providers.JsonRpcProvider;
    private readonly signer: ethers.Wallet;
    private readonly config: TradingExecutorConfig;

    /** Local nonce cache – keyed by lower-cased wallet address. */
    private readonly nonceCache: Map<string, number> = new Map();

    /** All submitted transactions indexed by tx hash. */
    private readonly transactionRegistry: Map<string, TransactionRecord> = new Map();

    constructor(config: TradingExecutorConfig) {
        this.config = config;
        this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
        this.signer = new ethers.Wallet(config.privateKey, this.provider);
    }

    // -------------------------------------------------------------------------
    // Nonce management
    // -------------------------------------------------------------------------

    /**
     * Returns the next nonce to use for the wallet.
     * Keeps a local counter so that back-to-back transactions don't collide.
     */
    private async getNextNonce(): Promise<number> {
        const address = (await this.signer.getAddress()).toLowerCase();
        const onChain = await this.provider.getTransactionCount(address, 'pending');
        const cached = this.nonceCache.get(address) ?? onChain;
        const nonce = Math.max(onChain, cached);
        this.nonceCache.set(address, nonce + 1);
        return nonce;
    }

    /**
     * Re-synchronises the local nonce with the on-chain pending count.
     * Call after a transaction is confirmed or definitively failed.
     */
    private async syncNonce(): Promise<void> {
        const address = (await this.signer.getAddress()).toLowerCase();
        const onChain = await this.provider.getTransactionCount(address, 'pending');
        this.nonceCache.set(address, onChain);
    }

    // -------------------------------------------------------------------------
    // Gas optimisation
    // -------------------------------------------------------------------------

    /**
     * Computes the effective gas price: base price × multiplier, capped at the
     * configured maximum.
     */
    private async computeGasPrice(): Promise<ethers.BigNumber> {
        const basePrice = await this.provider.getGasPrice();
        const multiplied = basePrice
            .mul(Math.round(this.config.gasPriceMultiplier * 100))
            .div(100);
        const maxPriceWei = ethers.utils.parseUnits(
            String(this.config.maxGasPriceGwei),
            'gwei'
        );
        return multiplied.gt(maxPriceWei) ? maxPriceWei : multiplied;
    }

    /**
     * Estimates total gas requirements for a series of swap steps and returns
     * an optimised gas price capped at the configured maximum.
     */
    async estimateGas(steps: SwapStep[]): Promise<GasEstimate> {
        const finalPrice = await this.computeGasPrice();

        // Rough per-hop gas model: approve ≈ 50 000, each swap hop ≈ 150 000
        let totalGas = 0;
        for (const step of steps) {
            const hops = Math.max(step.path.length - 1, 1);
            totalGas += 50_000 + hops * 150_000;
        }

        return {
            estimatedGas: totalGas,
            gasPrice: parseFloat(ethers.utils.formatUnits(finalPrice, 'gwei')),
        };
    }

    // -------------------------------------------------------------------------
    // Token approval
    // -------------------------------------------------------------------------

    /**
     * Grants unlimited approval to the DEX router for the input token when the
     * current allowance is insufficient.  Uses a fresh nonce and awaits mining.
     */
    private async ensureApproval(
        tokenAddress: string,
        routerAddress: string,
        requiredAmount: ethers.BigNumber
    ): Promise<void> {
        const owner = await this.signer.getAddress();
        const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
        const allowance: ethers.BigNumber = await token.allowance(owner, routerAddress);

        if (allowance.gte(requiredAmount)) {
            return;
        }

        logger.log(`Approving token ${tokenAddress} for router ${routerAddress}`);
        const nonce = await this.getNextNonce();
        const tx: ethers.ContractTransaction = await token.approve(
            routerAddress,
            ethers.constants.MaxUint256,
            { nonce }
        );
        await tx.wait(1);
        logger.log(`Approval confirmed (tx: ${tx.hash})`);
    }

    // -------------------------------------------------------------------------
    // Swap execution
    // -------------------------------------------------------------------------

    /**
     * Sends a single swap step to the DEX router.
     */
    private async executeSwapStep(
        step: SwapStep,
        nonce: number,
        gasPrice: ethers.BigNumber
    ): Promise<ethers.ContractTransaction> {
        const router = new ethers.Contract(step.dexRouter, DEX_ROUTER_ABI, this.signer);
        const recipient = await this.signer.getAddress();
        return router.swapExactTokensForTokens(
            ethers.BigNumber.from(step.amountIn),
            ethers.BigNumber.from(step.minAmountOut),
            step.path,
            recipient,
            step.deadline,
            { nonce, gasPrice }
        );
    }

    // -------------------------------------------------------------------------
    // Confirmation tracking
    // -------------------------------------------------------------------------

    /**
     * Waits for a transaction receipt up to `transactionTimeoutMs`.
     * Returns `null` on timeout so the caller can decide how to proceed.
     * The timeout is always cleared to avoid dangling timers in long-running processes.
     */
    private waitForConfirmation(
        tx: ethers.ContractTransaction
    ): Promise<ethers.ContractReceipt | null> {
        const { confirmationBlocks, transactionTimeoutMs } = this.config;
        return new Promise<ethers.ContractReceipt | null>((resolve) => {
            const timer = setTimeout(() => {
                logger.warn(`Confirmation timeout for tx ${tx.hash}`);
                resolve(null);
            }, transactionTimeoutMs);

            tx.wait(confirmationBlocks)
                .then((receipt) => {
                    clearTimeout(timer);
                    resolve(receipt);
                })
                .catch(() => {
                    clearTimeout(timer);
                    resolve(null);
                });
        });
    }

    // -------------------------------------------------------------------------
    // Multi-hop swap (atomic all-or-nothing)
    // -------------------------------------------------------------------------

    /**
     * Executes a sequence of swap steps representing a multi-hop arbitrage trade.
     *
     * Each step is submitted and confirmed before the next begins.  If any step
     * fails the error is recorded, the nonce is re-synced, and a failed
     * `TradeResult` is returned – the caller is responsible for any higher-level
     * rollback or alerting logic.
     */
    async executeMultiHopSwap(
        steps: SwapStep[],
        opportunity: Opportunity
    ): Promise<TradeResult> {
        const executedPrice =
            opportunity.marketData.prices[0] ?? {
                symbol: 'UNKNOWN',
                value: 0,
                timestamp: new Date(),
            };

        if (steps.length === 0) {
            return { success: false, message: 'No swap steps provided', executedPrice };
        }

        // Determine optimised gas price once for the whole batch
        const gasPrice = await this.computeGasPrice();

        const submitted: TransactionRecord[] = [];

        try {
            for (const step of steps) {
                await this.ensureApproval(
                    step.path[0],
                    step.dexRouter,
                    ethers.BigNumber.from(step.amountIn)
                );

                const nonce = await this.getNextNonce();
                logger.log(
                    `Submitting swap: router=${step.dexRouter} path=${step.path.join('->')} nonce=${nonce}`
                );

                const tx = await this.executeSwapStep(step, nonce, gasPrice);

                const record: TransactionRecord = {
                    hash: tx.hash,
                    state: TransactionState.PENDING,
                    nonce,
                    timestamp: new Date(),
                    opportunity,
                };
                this.transactionRegistry.set(tx.hash, record);
                submitted.push(record);

                logger.log(`Transaction submitted: ${tx.hash}`);

                const receipt = await this.waitForConfirmation(tx);

                if (!receipt || receipt.status !== 1) {
                    record.state = TransactionState.FAILED;
                    record.error = receipt
                        ? 'Transaction reverted on-chain'
                        : 'Confirmation timeout';
                    throw new Error(record.error);
                }

                record.state = TransactionState.CONFIRMED;
                record.gasUsed = receipt.gasUsed.toNumber();
                logger.log(
                    `Transaction confirmed: ${tx.hash} (gas used: ${record.gasUsed})`
                );
            }

            await this.syncNonce();
            return {
                success: true,
                message: `Executed ${steps.length} swap step(s) successfully`,
                executedPrice,
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error(`Multi-hop swap failed: ${message}`);

            // Mark any still-pending records as failed
            for (const record of submitted) {
                if (record.state === TransactionState.PENDING) {
                    record.state = TransactionState.FAILED;
                    record.error = message;
                }
            }

            await this.syncNonce();
            return { success: false, message, executedPrice };
        }
    }

    // -------------------------------------------------------------------------
    // Transaction registry queries
    // -------------------------------------------------------------------------

    /** Returns the tracked record for a given transaction hash, if any. */
    getTransactionRecord(txHash: string): TransactionRecord | undefined {
        return this.transactionRegistry.get(txHash);
    }

    /** Returns all tracked transactions. */
    getAllTransactions(): TransactionRecord[] {
        return Array.from(this.transactionRegistry.values());
    }

    /** Returns transactions that are still pending confirmation. */
    getPendingTransactions(): TransactionRecord[] {
        return this.getAllTransactions().filter(
            (t) => t.state === TransactionState.PENDING
        );
    }

    /** Returns the wallet address managed by this executor. */
    async getWalletAddress(): Promise<string> {
        return this.signer.getAddress();
    }

    /** Returns the current ETH balance of the managed wallet. */
    async getWalletBalance(): Promise<string> {
        const address = await this.signer.getAddress();
        const balance = await this.provider.getBalance(address);
        return ethers.utils.formatEther(balance);
    }
}

export default TradingExecutor;
