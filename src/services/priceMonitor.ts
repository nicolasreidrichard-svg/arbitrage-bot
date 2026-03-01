// priceMonitor.ts

import axios from 'axios';

class PriceMonitor {
    private dexUrls: string[];

    constructor(dexUrls: string[]) {
        this.dexUrls = dexUrls;
    }

    public async fetchPrices(): Promise<any[]> {
        const pricePromises = this.dexUrls.map(async (url) => {
            const response = await axios.get(url);
            return response.data;
        });

        return Promise.all(pricePromises);
    }

    public async displayPrices(): Promise<void> {
        try {
            const prices = await this.fetchPrices();
            prices.forEach((price, index) => {
                console.log(`Price from DEX ${index + 1}:`, price);
            });
        } catch (error) {
            console.error('Error fetching prices:', error);
        }
    }
}

export default PriceMonitor;
