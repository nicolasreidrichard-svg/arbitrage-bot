// src/__tests__/arbitrageDetector.test.ts

import ArbitrageDetector, { ExchangeRates } from '../services/arbitrageDetector';

const profitableRates: ExchangeRates = {
    binance: { coinbase: 1.05, kraken: 0.98 },
    coinbase: { binance: 0.98, kraken: 1.04 },
    kraken: { binance: 1.01, coinbase: 0.97 }
};

const noOpportunityRates: ExchangeRates = {
    binance: { coinbase: 0.98 },
    coinbase: { binance: 0.98 }
};

describe('ArbitrageDetector', () => {
    describe('constructor', () => {
        it('throws when exchangeRates is null', () => {
            expect(() => new ArbitrageDetector(null as unknown as ExchangeRates)).toThrow(
                'exchangeRates must be a non-null object'
            );
        });

        it('accepts valid exchange rates', () => {
            expect(() => new ArbitrageDetector(profitableRates)).not.toThrow();
        });
    });

    describe('identifyCrossExchangeOpportunities', () => {
        it('returns an array', () => {
            const detector = new ArbitrageDetector(profitableRates);
            expect(Array.isArray(detector.identifyCrossExchangeOpportunities())).toBe(true);
        });

        it('detects cross-exchange opportunities when product > 1', () => {
            // binance->coinbase (1.05) * coinbase->binance (0.98) = 1.029 > 1
            const detector = new ArbitrageDetector(profitableRates);
            const opps = detector.identifyCrossExchangeOpportunities();
            expect(opps.length).toBeGreaterThan(0);
            opps.forEach((o) => {
                expect(o.type).toBe('Cross-exchange');
                expect(o.profit).toBeGreaterThan(0);
            });
        });

        it('returns empty array when no cross-exchange opportunity exists', () => {
            const detector = new ArbitrageDetector(noOpportunityRates);
            expect(detector.identifyCrossExchangeOpportunities()).toHaveLength(0);
        });

        it('does not compare an exchange with itself', () => {
            const detector = new ArbitrageDetector(profitableRates);
            const opps = detector.identifyCrossExchangeOpportunities();
            opps.forEach((o) => expect(o.from).not.toBe(o.to));
        });
    });

    describe('identifyTriangularOpportunities', () => {
        it('returns an array', () => {
            const detector = new ArbitrageDetector(profitableRates);
            expect(Array.isArray(detector.identifyTriangularOpportunities())).toBe(true);
        });

        it('detects triangular opportunities when product > 1', () => {
            // Only add a route that produces a profit
            const rates: ExchangeRates = {
                A: { B: 1.1, C: 0.9 },
                B: { A: 0.9, C: 1.1 },
                C: { A: 1.1, B: 0.9 }
            };
            // A->B (1.1) * B->C (1.1) * C->A (1.1) = 1.331 > 1
            const detector = new ArbitrageDetector(rates);
            const opps = detector.identifyTriangularOpportunities();
            expect(opps.length).toBeGreaterThan(0);
            opps.forEach((o) => {
                expect(o.type).toBe('Triangular');
                expect(o.profit).toBeGreaterThan(0);
                expect(o.to2).toBeDefined();
            });
        });

        it('returns empty array when no triangular opportunity exists', () => {
            const rates: ExchangeRates = {
                A: { B: 0.95, C: 0.95 },
                B: { A: 0.95, C: 0.95 },
                C: { A: 0.95, B: 0.95 }
            };
            const detector = new ArbitrageDetector(rates);
            expect(detector.identifyTriangularOpportunities()).toHaveLength(0);
        });
    });
});
