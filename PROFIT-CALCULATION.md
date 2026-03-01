# Profit Calculation Reference

This document describes the profit calculation formulas used in the Arbitrage Bot.

---

## 1. Cross-Exchange Arbitrage

**Definition**: Buy an asset on Exchange A where the price is lower and sell it on Exchange B where the price is higher.

### Formula

```
profit = rateAtoB × rateBtoA − 1
```

- `rateAtoB` – the effective exchange rate when converting asset from Exchange A to Exchange B (i.e. sell price on B / buy price on A)
- `rateBtoA` – the effective exchange rate for the reverse direction

### Example

| Parameter | Value |
|---|---|
| Buy price on Exchange A (ETH/USDT) | 3,000 USDT |
| Sell price on Exchange B (ETH/USDT) | 3,060 USDT |
| `rateAtoB` | 3060 / 3000 = 1.020 |
| `rateBtoA` | 3000 / 3060 ≈ 0.9804 |
| **Raw profit** | 1.020 × 0.9804 − 1 = **0.0** (round trip) |

For a single-direction cross-exchange trade (buy on A, sell on B):

```
gross profit (%) = (sellPrice − buyPrice) / buyPrice × 100
```

Example: (3060 − 3000) / 3000 × 100 = **2%**

### After Gas/Fees

```
net profit (ETH) = tradeAmount × grossProfitRatio − gasCostEth
```

Example with 1 ETH trade:
- Gross profit: 1 ETH × 0.02 = 0.02 ETH
- Gas cost (21,000 gas × 20 gwei): 0.00042 ETH
- **Net profit: 0.01958 ETH**

---

## 2. Triangular Arbitrage

**Definition**: Exploit a price discrepancy across three trading pairs in a cycle (A → B → C → A).

### Formula

```
profit = rateAtoB × rateBtoC × rateCtoA − 1
```

- `rateAtoB` – conversion rate from Asset A to Asset B
- `rateBtoC` – conversion rate from Asset B to Asset C
- `rateCtoA` – conversion rate from Asset C back to Asset A

A positive result means the cycle returns more than was invested.

### Example

| Step | Pair | Rate |
|---|---|---|
| A → B | ETH → BTC | 0.0650 (ETH/BTC) |
| B → C | BTC → USDT | 45,000 (BTC/USDT) |
| C → A | USDT → ETH | 1/2,900 (USDT/ETH) |

```
profit = 0.0650 × 45,000 × (1/2,900) − 1
       = 2925 × 0.0003448 − 1
       = 1.0086 − 1
       = 0.0086  (≈ 0.86%)
```

### After Gas/Fees

Triangular arbitrage on-chain requires multiple swaps, each incurring a separate gas cost:

```
net profit = startAmount × profitRatio − Σ(gasCostEth per swap)
```

---

## 3. Gas Cost Calculation (Ethereum)

```
gasCostEth = gasUsed × gasPrice (gwei) / 1,000,000,000
```

For EIP-1559 transactions:

```
effectiveGasPrice = min(maxFeePerGas, baseFee + maxPriorityFeePerGas)
gasCostEth = gasUsed × effectiveGasPrice / 1e18
```

Typical gas limits:
| Operation | Typical Gas |
|---|---|
| ETH transfer | 21,000 |
| ERC-20 transfer | 65,000 |
| Uniswap V3 swap | 130,000–200,000 |

---

## 4. Solana Fee Calculation

Solana fees are based on compute units (CU):

```
feeLamports = microLamportsPerCU × computeUnits / 1,000,000 + baseFee
feeSol = feeLamports / 1,000,000,000
```

- Base fee: 5,000 lamports per signature
- Priority fee: set via `ComputeBudgetProgram.setComputeUnitPrice`

---

## 5. Minimum Profitable Trade Size

To determine the minimum trade size that covers gas costs:

```
minTradeSize = gasCostEth / profitRatio
```

Example:
- Gas cost: 0.001 ETH
- Spread (profit ratio): 0.5% = 0.005
- **Min trade size: 0.001 / 0.005 = 0.2 ETH**

---

## 6. Implementation

These formulas are implemented in [`src/earnings/earnings-calculator.ts`](src/earnings/earnings-calculator.ts):

```typescript
// Cross-exchange
calculateCrossExchangeProfit(rateAtoB, rateBtoA) → rateAtoB * rateBtoA - 1

// Triangular
calculateTriangularProfit(rateAtoB, rateBtoC, rateCtoA) → rateAtoB * rateBtoC * rateCtoA - 1

// Gas estimation
estimateGasCostEth(gasLimit, gasPriceGwei) → (gasLimit * gasPriceGwei) / 1e9

// Profitability check
isCrossExchangeProfitable(rateAtoB, rateBtoA, tradeAmountEth, gasCostEth) → boolean
```
