# Quick Start Guide

Get the Arbitrage Bot running with your API keys and wallet addresses in minutes.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18.x or 20.x |
| npm | 8+ |

---

## 1. Clone the repository

```bash
git clone https://github.com/nicolasreidrichard-svg/arbitrage-bot.git
cd arbitrage-bot
```

---

## 2. Run the setup script

```bash
chmod +x setup.sh
./setup.sh
```

The interactive script will walk you through every step:

1. **Prerequisite checks** – Node.js and npm version validation.
2. **Dependency installation** – `npm install` run automatically.
3. **Environment configuration** – creates `.env` from `.env.example` and shows
   exactly which placeholders to replace (API keys, wallet addresses, RPC URLs).
4. **Crypto-wallet-manager setup** – displays your current profit-routing
   configuration and explains how to enable automatic profit deposits.
5. **API health checks** – verifies connectivity to Etherscan, Solscan, Binance,
   Coinbase, and your Ethereum RPC endpoint.
6. **Bot launch** – starts `src/index.ts` once all checks pass.

---

## 3. Fill in your .env

When the script creates `.env`, open it and replace every placeholder:

```env
# ── Wallet (REQUIRED for profit routing) ─────────────────────────────────────
WALLET_ADDRESS=0xYourTradingWalletAddress       # replace with your address
WALLET_PRIVATE_KEY=your-private-key             # NEVER share or commit this
ETH_ADDRESS=0xYourEthAddress
SOL_ADDRESS=YourSolanaAddress
ETH_PROFIT_DESTINATION=0xYourProfitWalletAddress
SOL_PROFIT_DESTINATION=YourSolanaProfitAddress

# ── Exchange API Keys ─────────────────────────────────────────────────────────
BINANCE_API_KEY=your-binance-api-key
BINANCE_API_SECRET=your-binance-api-secret
COINBASE_API_KEY=your-coinbase-api-key
COINBASE_API_SECRET=your-coinbase-api-secret
COINBASE_PASSPHRASE=your-coinbase-passphrase

# ── Blockchain API Keys ───────────────────────────────────────────────────────
ETHERSCAN_API_KEY=your-etherscan-api-key
SOLSCAN_API_KEY=your-solscan-api-key
HELIUS_API_KEY=your-helius-api-key

# ── RPC Endpoints ─────────────────────────────────────────────────────────────
RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/your-key
RPC_URL_2=https://mainnet.infura.io/v3/your-key   # fallback
```

See [API-INTEGRATION-GUIDE.md](API-INTEGRATION-GUIDE.md) for step-by-step
instructions on obtaining each key.

---

## 4. Security reminders

> **These steps protect your funds and API access.**

- **Never commit `.env`** — it is already in `.gitignore`, but double-check before every push.
- **Dedicated trading wallet** — use a wallet you created solely for this bot,
  funded only with the amount you are willing to risk.
- **No withdrawal permissions** — when creating exchange API keys, enable only
  *Spot & Margin Trading* (read + trade). Never enable withdrawals.
- **IP whitelisting** — restrict each exchange API key to your server's IP address.
- **File permissions** — the setup script sets `.env` to `chmod 600` automatically.
  Verify with `ls -la .env`.
- **Rotate keys regularly** — update your API keys every few months and after any
  suspected compromise.

---

## 5. Crypto-wallet-manager: monitoring profits

The bot includes a built-in crypto-wallet-manager (`src/earnings/`) that fetches
transaction history from Etherscan and Solscan, calculates net profit after
gas/fees, and can automatically route profits to a destination wallet.

### Enable automatic profit routing

In `.env`:

```env
AUTO_ROUTE_PROFITS=true
ETH_PROFIT_DESTINATION=0xYourProfitWalletAddress
SOL_PROFIT_DESTINATION=YourSolanaProfitAddress
PROFIT_THRESHOLD_ETH=0.001   # minimum ETH profit before routing
PROFIT_THRESHOLD_SOL=0.01    # minimum SOL profit before routing
```

### Monitor wallet balances and earnings

```bash
# Fetch latest transaction history
npx ts-node src/earnings/earnings-fetcher.ts

# Generate a profit/loss report
npx ts-node src/earnings/earnings-report.ts

# Run the full health check
npx ts-node src/utils/health-check.ts
```

### Configure automatic earnings reports

```env
EARNINGS_REPORTING_ENABLED=true
EARNINGS_REPORT_INTERVAL_MS=3600000   # every hour
EARNINGS_REPORT_FORMAT=text           # or 'json'
```

See [EARNINGS-SETUP.md](EARNINGS-SETUP.md) for a complete walkthrough of the
earnings and wallet-manager modules.

---

## 6. Manual start (without the setup script)

```bash
npm install
cp .env.example .env
# edit .env with your values
npx ts-node src/utils/health-check.ts   # verify connectivity
npx ts-node src/index.ts                # start the bot
```

For non-interactive automated deployments (CI/CD or server restarts):

```bash
./automated-deployment.sh
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `Missing environment variable` | Re-run `./setup.sh`; fill in all placeholders in `.env` |
| Health check shows `down` | Verify the API key in `.env`; check network/firewall rules |
| `ETH wallet not initialised` | Set `RPC_URL_1` and `WALLET_PRIVATE_KEY` in `.env` |
| TypeScript compilation error | Run `npx tsc --noEmit` to see details |
| Permission denied on `.env` | Run `chmod 600 .env` |

For full deployment options (systemd service, Docker, etc.) see
[DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md).
