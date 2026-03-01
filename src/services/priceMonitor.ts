// priceMonitor.ts

import axios from 'axios';
import logger from '../utils/logger';

export interface PriceData {
    url: string;
    data: unknown;
    error?: string;
}

class PriceMonitor {
    private dexUrls: string[];

    constructor(dexUrls: string[]) {
        if (!Array.isArray(dexUrls) || dexUrls.length === 0) {
            throw new Error('dexUrls must be a non-empty array');
        }
        this.dexUrls = dexUrls;
    }

    public async fetchPrices(): Promise<PriceData[]> {
        const pricePromises = this.dexUrls.map(async (url): Promise<PriceData> => {
            try {
                const response = await axios.get(url);
                return { url, data: response.data };
            } catch (err) {
                const axiosErr = err as { response?: { status?: number }; message?: string };
                const message =
                    axiosErr.response !== undefined
                        ? `HTTP ${axiosErr.response.status ?? 'unknown'}: ${axiosErr.message ?? 'error'}`
                        : err instanceof Error
                        ? err.message
                        : 'Unknown error';
                logger.error(`Failed to fetch price from ${url}: ${message}`);
                return { url, data: null, error: message };
            }
        });

        return Promise.all(pricePromises);
    }

    public async displayPrices(): Promise<void> {
        const prices = await this.fetchPrices();
        prices.forEach((result, index) => {
            if (result.error) {
                logger.error(`DEX ${index + 1} (${result.url}): ${result.error}`);
            } else {
                logger.log(`Price from DEX ${index + 1} (${result.url}): ${JSON.stringify(result.data)}`);
            }
        });
    }
}

export default PriceMonitor;


