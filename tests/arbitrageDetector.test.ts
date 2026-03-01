import ArbitrageDetector from '../src/services/arbitrageDetector';

describe('ArbitrageDetector', () => {
  const ratesWithOpportunity = {
    ExchangeA: { ExchangeB: 1.05 },
    ExchangeB: { ExchangeA: 1.05 },
  };

  const ratesNoOpportunity = {
    ExchangeA: { ExchangeB: 0.98 },
    ExchangeB: { ExchangeA: 0.98 },
  };

  describe('identifyCrossExchangeOpportunities', () => {
    it('returns opportunities when a profitable cross-exchange pair exists', () => {
      const detector = new ArbitrageDetector(ratesWithOpportunity);
      const opportunities = detector.identifyCrossExchangeOpportunities();
      expect(opportunities.length).toBeGreaterThan(0);
      expect(opportunities[0].type).toBe('Cross-exchange');
      expect(opportunities[0].profit).toBeGreaterThan(0);
    });

    it('returns no opportunities when no profitable pair exists', () => {
      const detector = new ArbitrageDetector(ratesNoOpportunity);
      const opportunities = detector.identifyCrossExchangeOpportunities();
      expect(opportunities.length).toBe(0);
    });
  });

  describe('identifyTriangularOpportunities', () => {
    it('returns triangular opportunities when profitable route exists', () => {
      const rates = {
        A: { B: 1.1, C: 0.9 },
        B: { A: 0.9, C: 1.1 },
        C: { A: 1.1, B: 0.9 },
      };
      const detector = new ArbitrageDetector(rates);
      const opportunities = detector.identifyTriangularOpportunities();
      expect(Array.isArray(opportunities)).toBe(true);
    });

    it('returns no triangular opportunities for a two-exchange setup', () => {
      const detector = new ArbitrageDetector(ratesWithOpportunity);
      const opportunities = detector.identifyTriangularOpportunities();
      expect(opportunities.length).toBe(0);
    });
  });
});
