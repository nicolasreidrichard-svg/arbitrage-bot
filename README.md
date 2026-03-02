# Arbitrage Bot

## Features
- Automated arbitrage trading across multiple exchanges.
- Real-time price monitoring and alerts.
- User-friendly configuration for trading parameters.
- Historical data analysis and reporting.

## Architecture
The Arbitrage Bot is structured into several key components:
1. **Market Data Fetcher**: Gathers real-time prices from selected exchanges.
2. **Arbitrage Engine**: Analyzes price differences and identifies profitable opportunities.
3. **Trading Executor**: Places orders on the exchanges based on the strategies defined by the user.
4. **User Interface**: A web-based dashboard that allows users to configure settings and view reports.

## Quick Start

Run the interactive setup script – it handles dependency installation, `.env` configuration, environment-variable validation, and bot launch in one step:

```bash
git clone https://github.com/nicolasreidrichard-svg/arbitrage-bot.git
cd arbitrage-bot
chmod +x setup.sh
./setup.sh
```

On first run the script creates `.env` from `.env.example` and lists every placeholder you need to fill in (API keys, wallet addresses, RPC endpoints). Edit the file, then run `./setup.sh` again to validate and start the bot.

For the full step-by-step walkthrough see [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md).

## Wallet Management

Advanced wallet features (HD wallets, encrypted key storage, multi-chain balance monitoring) are provided by the companion repository:

> **[nicolasreidrichard-svg/crypto-wallet-manager](https://github.com/nicolasreidrichard-svg/crypto-wallet-manager)**

Clone it alongside this repo and follow its README before running the bot in production.

## Required Configuration

Copy `.env.example` to `.env` and fill in the following values:

| Variable | Description | Where to get it |
|---|---|---|
| `WALLET_ADDRESS` | Ethereum trading wallet address | Your wallet |
| `WALLET_PRIVATE_KEY` | Private key for the trading wallet | Your wallet – **keep secret** |
| `ETH_ADDRESS` | Ethereum address for earnings tracking | Your wallet |
| `SOL_ADDRESS` | Solana address for earnings tracking | Your wallet |
| `RPC_URL_1` | Ethereum RPC endpoint | Alchemy / Infura / Helius |
| `ETHERSCAN_API_KEY` | Etherscan API key | https://etherscan.io/myapikey |
| `HELIUS_API_KEY` | Helius API key (Solana RPC) | https://www.helius.dev/ |
| `BINANCE_API_KEY` / `BINANCE_API_SECRET` | Binance credentials | Binance API management |
| `COINBASE_API_KEY` / `COINBASE_API_SECRET` | Coinbase Advanced Trade credentials | Coinbase API settings |

See [API-INTEGRATION-GUIDE.md](API-INTEGRATION-GUIDE.md) for detailed instructions on obtaining each key.

## ⚠ Security Reminders

- **Never commit `.env` to version control** – it contains private keys and API secrets.
- Use a **dedicated trading wallet**, not your primary wallet.
- Only fund the bot with an amount you are willing to risk.
- Never enable **withdrawal permissions** on exchange API keys.
- Restrict API key IP access to your server's IP address.
- Set restrictive file permissions on `.env`: `chmod 600 .env`

## Usage Guide
- **Starting the Bot**: Run `./setup.sh` (or `npx ts-node src/index.ts` directly after setup).
- **Configuration**: Modify `.env` to customize trading strategies and parameters.
- **Monitoring Performance**: Use the web dashboard to monitor live trading performance and adjust settings as needed.

## Conclusion
The Arbitrage Bot is designed to simplify automated trading for users while providing powerful features and insights into market dynamics. For support, please consult the documentation or raise an issue on GitHub.