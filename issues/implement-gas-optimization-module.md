# Implement Gas Optimization Module

## Body
Build gas cost calculation and optimization to maximize profit margins by reducing transaction costs.

### Acceptance Criteria:
- Estimate gas costs for each transaction type
- Suggest optimal gas price (standard, fast, instant)
- Calculate net profit after gas expenses
- Monitor network congestion and adjust pricing
- Batch transactions when beneficial
- Unit tests for gas calculations.

## Implementation Details:
- Create `src/modules/gasOptimizer.ts`
- Integrate with gas price APIs (Etherscan, GasNow, etc.)
- Implement profit-after-gas calculations
- Support dynamic gas price adjustment
- Create GasEstimate interface