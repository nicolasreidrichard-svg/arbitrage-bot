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

## Quick Setup

Run the interactive setup script for a guided first-time configuration:

```bash
git clone https://github.com/nicolasreidrichard-svg/arbitrage-bot.git
cd arbitrage-bot
chmod +x setup.sh
./setup.sh
```

The script handles dependency installation, `.env` creation with placeholders for
your API keys and wallet addresses, security reminders, health checks, and
launching the bot. See [QUICKSTART.md](QUICKSTART.md) for the full guide.

## Manual Setup
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/nicolasreidrichard-svg/arbitrage-bot.git
   cd arbitrage-bot
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and wallet addresses
   ```
4. **Run the Bot**:
   ```bash
   npx ts-node src/index.ts
   ```

## Usage Guide
- **Starting the Bot**: After setup, run `npm start` to launch the bot.
- **Configuration**: Modify the `.env` file to customize trading strategies and parameters.
- **Monitoring Performance**: Use the web dashboard to monitor live trading performance and adjust settings as needed.

## Conclusion
The Arbitrage Bot is designed to simplify automated trading for users while providing powerful features and insights into market dynamics. For support, please consult the documentation or raise an issue on GitHub.