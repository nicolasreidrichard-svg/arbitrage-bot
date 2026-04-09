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

## Setup Instructions

### Quick Start (recommended)

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/nicolasreidrichard-svg/arbitrage-bot.git
   cd arbitrage-bot
   ```
2. **Run the setup script** – it will install dependencies, create your `.env` from the template, guide you through required values, verify the configuration, and start the bot:
   ```bash
   bash setup.sh
   ```
   On first run the script creates `.env` and exits so you can fill in your credentials. Re-run it after editing `.env`.

### Manual Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env and replace every placeholder with your real values
   nano .env
   ```
   Key values to set:

   | Variable | Description |
   |---|---|
   | `WALLET_ADDRESS` | Your Ethereum wallet address |
   | `WALLET_PRIVATE_KEY` | Your Ethereum private key — **keep secret** |
   | `ETH_ADDRESS` | Ethereum address to track |
   | `SOL_ADDRESS` | Solana address to track |
   | `ETHERSCAN_API_KEY` | From [etherscan.io/myapikey](https://etherscan.io/myapikey) |
   | `BINANCE_API_KEY` / `BINANCE_API_SECRET` | From [Binance API Management](https://www.binance.com/en/my/settings/api-management) |
   | `RPC_URL_1` | Ethereum JSON-RPC endpoint (Infura, Alchemy, etc.) |

   See [API-INTEGRATION-GUIDE.md](API-INTEGRATION-GUIDE.md) for full details on obtaining each key.

3. **Start the bot**:
   ```bash
   npm start
   ```

### Wallet Management

For advanced wallet management and key generation, use the companion repo:
[https://github.com/nicolasreidrichard-svg/crypto-wallet-manager](https://github.com/nicolasreidrichard-svg/crypto-wallet-manager)

## Security Reminders

- **Never commit `.env`** to version control — it is listed in `.gitignore`.
- Set restrictive permissions on your env file: `chmod 600 .env`.
- Use a **dedicated trading wallet**, not your primary wallet.
- Only fund the bot with an amount you are willing to risk.
- Use **read-only API keys** on exchanges where write access is not required.
- **Whitelist your server IP** on all exchange API keys.
- Rotate API keys regularly and monitor them for unexpected usage.

## Usage Guide
- **Starting the Bot**: Run `bash setup.sh` or `npm start` to launch the bot.
- **Configuration**: Modify the `.env` file to customize trading strategies and parameters.
- **Monitoring Performance**: Use the web dashboard to monitor live trading performance and adjust settings as needed.
- **Full Deployment Guide**: See [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) for advanced setup, systemd service configuration, and troubleshooting.

## Conclusion
The Arbitrage Bot is designed to simplify automated trading for users while providing powerful features and insights into market dynamics. For support, please consult the documentation or raise an issue on GitHub.