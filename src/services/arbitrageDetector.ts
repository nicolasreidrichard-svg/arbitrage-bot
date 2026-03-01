// src/services/arbitrageDetector.ts

export interface ExchangeRates {
    [from: string]: { [to: string]: number };
}

export interface ArbitrageOpportunity {
    type: 'Cross-exchange' | 'Triangular';
    from: string;
    to: string;
    to2?: string;
    profit: number;
}

class ArbitrageDetector {
    private exchangeRates: ExchangeRates;

    constructor(exchangeRates: ExchangeRates) {
        if (!exchangeRates || typeof exchangeRates !== 'object') {
            throw new Error('exchangeRates must be a non-null object');
        }
        this.exchangeRates = exchangeRates;
    }

    identifyCrossExchangeOpportunities(): ArbitrageOpportunity[] {
        const opportunities: ArbitrageOpportunity[] = [];
        const exchanges = Object.keys(this.exchangeRates);

        for (let i = 0; i < exchanges.length; i++) {
            for (let j = 0; j < exchanges.length; j++) {
                if (i !== j) {
                    const rateAtoB = this.exchangeRates[exchanges[i]]?.[exchanges[j]];
                    const rateBtoA = this.exchangeRates[exchanges[j]]?.[exchanges[i]];

                    if (rateAtoB && rateBtoA && rateAtoB * rateBtoA > 1) {
                        opportunities.push({
                            type: 'Cross-exchange',
                            from: exchanges[i],
                            to: exchanges[j],
                            profit: rateAtoB * rateBtoA - 1
                        });
                    }
                }
            }
        }
        return opportunities;
    }

    identifyTriangularOpportunities(): ArbitrageOpportunity[] {
        const opportunities: ArbitrageOpportunity[] = [];
        const exchanges = Object.keys(this.exchangeRates);

        for (let i = 0; i < exchanges.length; i++) {
            for (let j = 0; j < exchanges.length; j++) {
                for (let k = 0; k < exchanges.length; k++) {
                    if (i !== j && j !== k && i !== k) {
                        const rateAtoB = this.exchangeRates[exchanges[i]]?.[exchanges[j]];
                        const rateBtoC = this.exchangeRates[exchanges[j]]?.[exchanges[k]];
                        const rateCtoA = this.exchangeRates[exchanges[k]]?.[exchanges[i]];

                        if (rateAtoB && rateBtoC && rateCtoA && rateAtoB * rateBtoC * rateCtoA > 1) {
                            opportunities.push({
                                type: 'Triangular',
                                from: exchanges[i],
                                to: exchanges[j],
                                to2: exchanges[k],
                                profit: rateAtoB * rateBtoC * rateCtoA - 1
                            });
                        }
                    }
                }
            }
        }
        return opportunities;
    }
}

export default ArbitrageDetector;

