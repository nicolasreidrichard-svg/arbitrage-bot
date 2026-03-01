// src/__tests__/walletManager.test.ts

import { ethers } from 'ethers';
import WalletManager from '../modules/walletManager';

jest.mock('../utils/logger', () => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
}));

// A known test private key (never use in production)
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

describe('WalletManager', () => {
    describe('constructor', () => {
        it('loads a wallet from a private key', () => {
            const wm = new WalletManager(TEST_PRIVATE_KEY);
            expect(wm.getAddress()).toBe(TEST_ADDRESS);
        });

        it('throws for empty private key', () => {
            expect(() => new WalletManager('')).toThrow('privateKey must be a non-empty string');
        });

        it('throws for invalid private key', () => {
            expect(() => new WalletManager('not-a-key')).toThrow('Failed to load wallet');
        });
    });

    describe('getAddress', () => {
        it('returns the correct Ethereum address', () => {
            const wm = new WalletManager(TEST_PRIVATE_KEY);
            expect(ethers.utils.isAddress(wm.getAddress())).toBe(true);
        });
    });

    describe('sendTransaction', () => {
        it('throws when no provider is configured', async () => {
            const wm = new WalletManager(TEST_PRIVATE_KEY);
            await expect(
                wm.sendTransaction({ to: TEST_ADDRESS, value: '0.01' })
            ).rejects.toThrow('No provider configured');
        });
    });

    describe('getPendingTransactions', () => {
        it('returns an empty array initially', () => {
            const wm = new WalletManager(TEST_PRIVATE_KEY);
            expect(wm.getPendingTransactions()).toEqual([]);
        });
    });

    describe('getWalletInfo', () => {
        it('returns wallet info without provider (no ETH balance)', async () => {
            const wm = new WalletManager(TEST_PRIVATE_KEY);
            const info = await wm.getWalletInfo();
            expect(info.address).toBe(TEST_ADDRESS);
            // No provider — balance object should be empty
            expect(Object.keys(info.balance)).toHaveLength(0);
        });
    });
});
