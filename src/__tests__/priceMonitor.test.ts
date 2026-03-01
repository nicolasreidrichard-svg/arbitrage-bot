// src/__tests__/priceMonitor.test.ts

import axios from 'axios';
import PriceMonitor from '../services/priceMonitor';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../utils/logger', () => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
}));

describe('PriceMonitor', () => {
    describe('constructor', () => {
        it('throws for empty dexUrls array', () => {
            expect(() => new PriceMonitor([])).toThrow('dexUrls must be a non-empty array');
        });

        it('throws for non-array input', () => {
            expect(() => new PriceMonitor(null as unknown as string[])).toThrow();
        });

        it('accepts a valid array of URLs', () => {
            expect(() => new PriceMonitor(['https://example.com'])).not.toThrow();
        });
    });

    describe('fetchPrices', () => {
        it('returns data for each URL on success', async () => {
            mockedAxios.get.mockResolvedValueOnce({ data: { price: 100 } });
            mockedAxios.get.mockResolvedValueOnce({ data: { price: 200 } });

            const monitor = new PriceMonitor(['https://dex1.com', 'https://dex2.com']);
            const results = await monitor.fetchPrices();

            expect(results).toHaveLength(2);
            expect(results[0].data).toEqual({ price: 100 });
            expect(results[0].error).toBeUndefined();
            expect(results[1].data).toEqual({ price: 200 });
        });

        it('returns error info for a failed URL without throwing', async () => {
            mockedAxios.get.mockResolvedValueOnce({ data: { price: 100 } });
            mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

            const monitor = new PriceMonitor(['https://dex1.com', 'https://dex2.com']);
            const results = await monitor.fetchPrices();

            expect(results).toHaveLength(2);
            expect(results[0].error).toBeUndefined();
            expect(results[1].error).toContain('Network error');
            expect(results[1].data).toBeNull();
        });

        it('handles all URLs failing gracefully', async () => {
            mockedAxios.get.mockRejectedValue(new Error('Timeout'));

            const monitor = new PriceMonitor(['https://dex1.com', 'https://dex2.com']);
            const results = await monitor.fetchPrices();

            expect(results).toHaveLength(2);
            results.forEach((r) => expect(r.error).toBeDefined());
        });
    });

    describe('displayPrices', () => {
        it('completes without throwing even when a URL fails', async () => {
            mockedAxios.get.mockRejectedValue(new Error('Timeout'));
            const monitor = new PriceMonitor(['https://dex1.com']);
            await expect(monitor.displayPrices()).resolves.toBeUndefined();
        });
    });
});
