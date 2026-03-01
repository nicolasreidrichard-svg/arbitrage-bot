# Earnings Setup Guide

This guide walks you through setting up the earnings tracking system for the Arbitrage Bot. The system fetches transaction history from Etherscan (ETH) and Solscan (Solana), calculates net profits after gas/fees, and can automatically route profits to a destination wallet.

## Prerequisites

- Node.js 18+
- A funded Ethereum wallet with private key access
- API keys for Etherscan and Solscan (see [API-INTEGRATION-GUIDE.md](API-INTEGRATION-GUIDE.md))

## Step 1 – Configure Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

The minimum required variables for earnings tracking:

| Variable | Description |
|---|---|
| `ETHERSCAN_API_KEY` | Etherscan API key for ETH transaction history |
| `SOLSCAN_API_KEY` | Solscan Pro API key for Solana transaction history |
| `ETH_ADDRESS` | Ethereum address to track (default: `0x08143f357d31Ec0D38B40eB383fC3450410c5CC7`) |
| `SOL_ADDRESS` | Solana address to track (default: `D1DYRrJqfuTnuTszWtv3nHChCcanGm7Q1eF2GUUQ2r3`) |

## Step 2 – Configure Profit Thresholds

Set minimum profit thresholds before automatic routing is triggered:

```env
PROFIT_THRESHOLD_ETH=0.001   # 0.001 ETH minimum
PROFIT_THRESHOLD_SOL=0.01    # 0.01 SOL minimum
AUTO_ROUTE_PROFITS=false     # set to true to enable automatic routing
```

## Step 3 – Configure Profit Destination Wallets

Specify where profits should be routed:

```env
ETH_PROFIT_DESTINATION=0xYourDestinationAddress
SOL_PROFIT_DESTINATION=YourSolanaDestinationAddress
WALLET_PRIVATE_KEY=your-private-key   # required for ETH routing
RPC_URL_1=https://your-eth-rpc-url
```

> **Security**: Never commit your `.env` file to version control. Keep `WALLET_PRIVATE_KEY` secret.

## Step 4 – Run the Earnings Fetcher

```typescript
import EarningsFetcher from './src/earnings/earnings-fetcher';

const fetcher = new EarningsFetcher();
const data = await fetcher.fetchAllTransactions();
console.log(`ETH transactions: ${data.eth.length}`);
console.log(`SOL transactions: ${data.sol.length}`);
```

## Step 5 – Generate a Report

```typescript
import EarningsReport from './src/earnings/earnings-report';

const report = new EarningsReport();
await report.generateReport('monthly');
```

## Step 6 – Configure Reporting Interval

For automatic periodic reporting, set:

```env
EARNINGS_REPORTING_ENABLED=true
EARNINGS_REPORT_INTERVAL_MS=3600000   # every hour
EARNINGS_REPORT_FORMAT=text           # or 'json'
```

## Step 7 – Run the Health Check

Verify all API connections before starting:

```bash
npx ts-node src/utils/health-check.ts
```

## Step 8 – Run the Tests

```bash
npx ts-node src/tests/test-earnings-fetcher.ts
```

## Earnings Module Architecture

```
src/earnings/
├── earnings-fetcher.ts      ← fetches raw transaction data
├── earnings-calculator.ts   ← calculates net profit after gas/fees
├── earnings-report.ts       ← generates consolidated reports
└── wallet-deposit-router.ts ← routes profits to destination wallets

src/config/
├── earnings-config.ts       ← profit thresholds & reporting config
└── exchange-config.ts       ← exchange credentials & settings
```

## Profit Calculation

See [PROFIT-CALCULATION.md](PROFIT-CALCULATION.md) for detailed formulas.

## Deployment

See [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) for full deployment instructions.
