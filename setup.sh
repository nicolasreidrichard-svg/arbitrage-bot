#!/usr/bin/env bash
# setup.sh
# Final setup script for the Arbitrage Bot.
# Guides you through environment configuration, security checks, health checks,
# crypto-wallet-manager integration, and launching the bot.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/setup.log"
MIN_NODE_VERSION=18

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

log()     { local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"; echo -e "$msg" | tee -a "$LOG_FILE"; }
info()    { echo -e "${CYAN}${BOLD}[INFO]${RESET}  $*"; log "[INFO]  $*"; }
success() { echo -e "${GREEN}${BOLD}[OK]${RESET}    $*"; log "[OK]    $*"; }
warn()    { echo -e "${YELLOW}${BOLD}[WARN]${RESET}  $*"; log "[WARN]  $*"; }
error()   { echo -e "${RED}${BOLD}[ERROR]${RESET} $*" >&2; log "[ERROR] $*"; exit 1; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          Arbitrage Bot — First-Time Setup                ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo "This script will:"
echo "  1. Check prerequisites (Node.js, npm)"
echo "  2. Install dependencies"
echo "  3. Create and validate your .env configuration"
echo "  4. Run API health checks"
echo "  5. Configure the crypto-wallet-manager for profit monitoring"
echo "  6. Start the bot"
echo ""
echo -e "${YELLOW}${BOLD}⚠  Security reminders before you begin:${RESET}"
echo "  • Never commit your .env file — it contains private keys and API secrets."
echo "  • Use a dedicated trading wallet, NOT your primary wallet."
echo "  • Only fund the bot with an amount you are willing to risk."
echo "  • Never enable withdrawal permissions on exchange API keys."
echo "  • Whitelist your server's IP on all exchange API key settings."
echo "  • Keep your server's OS and Node.js up to date."
echo ""
read -r -p "Press Enter to continue, or Ctrl+C to exit..." _

# ── Step 1: Prerequisites ─────────────────────────────────────────────────────
info "Checking prerequisites..."

if ! command -v node &>/dev/null; then
    error "Node.js is not installed. Install Node.js ${MIN_NODE_VERSION}+ from https://nodejs.org"
fi

NODE_VERSION=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_VERSION" -lt "$MIN_NODE_VERSION" ]; then
    error "Node.js ${MIN_NODE_VERSION}+ is required. Found: ${NODE_VERSION}. Please upgrade."
fi
success "Node.js $(node --version)"

if ! command -v npm &>/dev/null; then
    error "npm is not installed. It should ship with Node.js."
fi
success "npm $(npm --version)"

# ── Step 2: Install dependencies ──────────────────────────────────────────────
info "Installing dependencies..."
cd "$SCRIPT_DIR"
npm install 2>&1 | tee -a "$LOG_FILE"
success "Dependencies installed"

# ── Step 3: Environment configuration ────────────────────────────────────────
info "Configuring environment..."

ENV_FILE="${SCRIPT_DIR}/.env"

if [ ! -f "$ENV_FILE" ]; then
    cp "${SCRIPT_DIR}/.env.example" "$ENV_FILE"
    info "Created .env from template."
    echo ""
    echo -e "${BOLD}You must now fill in your API keys and wallet addresses in .env.${RESET}"
    echo ""
    echo "  Open ${ENV_FILE} and replace every placeholder with your real values."
    echo ""
    echo "  Key placeholders to replace:"
    echo ""
    echo -e "  ${YELLOW}# ── Wallet (REQUIRED for profit routing) ──────────────────────${RESET}"
    echo "  WALLET_ADDRESS=0xYourWalletAddress          # your trading wallet"
    echo "  WALLET_PRIVATE_KEY=your-private-key          # NEVER share this"
    echo "  ETH_ADDRESS=0xYourEthAddress                 # Ethereum address"
    echo "  SOL_ADDRESS=YourSolanaAddress                # Solana address"
    echo "  ETH_PROFIT_DESTINATION=0xYourProfitAddress   # where profits are sent"
    echo "  SOL_PROFIT_DESTINATION=YourSolanaProfitAddr  # where SOL profits go"
    echo ""
    echo -e "  ${YELLOW}# ── Exchange API Keys ─────────────────────────────────────────${RESET}"
    echo "  BINANCE_API_KEY=your-binance-api-key"
    echo "  BINANCE_API_SECRET=your-binance-api-secret"
    echo "  COINBASE_API_KEY=your-coinbase-api-key"
    echo "  COINBASE_API_SECRET=your-coinbase-api-secret"
    echo "  COINBASE_PASSPHRASE=your-coinbase-passphrase"
    echo ""
    echo -e "  ${YELLOW}# ── Blockchain API Keys ───────────────────────────────────────${RESET}"
    echo "  ETHERSCAN_API_KEY=your-etherscan-api-key"
    echo "  SOLSCAN_API_KEY=your-solscan-api-key"
    echo "  HELIUS_API_KEY=your-helius-api-key"
    echo ""
    echo -e "  ${YELLOW}# ── RPC Endpoints ─────────────────────────────────────────────${RESET}"
    echo "  RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/your-key"
    echo "  RPC_URL_2=https://mainnet.infura.io/v3/your-key  # fallback"
    echo ""
    echo "  See API-INTEGRATION-GUIDE.md for how to obtain each key."
    echo ""
    read -r -p "Press Enter once you have saved your .env file..."
fi

# Secure the file
chmod 600 "$ENV_FILE"
success ".env permissions set to 600"

# Validate required variables
# shellcheck source=/dev/null
source "$ENV_FILE"

REQUIRED_VARS=(
    "ETH_ADDRESS"
    "SOL_ADDRESS"
    "WALLET_ADDRESS"
    "RPC_URL_1"
    "ETHERSCAN_API_KEY"
    "BINANCE_API_KEY"
    "COINBASE_API_KEY"
)

MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
    val="${!var:-}"
    # Flag empty values and the exact placeholder strings used in .env.example
    if [ -z "$val" ] || echo "$val" | grep -qiE '^(your-[a-z]|0xYourWallet|0xYourEth|0xYourProfit|YourSolana)'; then
        MISSING+=("$var")
    fi
done

if [ "${#MISSING[@]}" -gt 0 ]; then
    warn "The following variables still contain placeholder values or are unset:"
    for v in "${MISSING[@]}"; do
        warn "  - $v"
    done
    warn "The bot may not function correctly. Update .env and re-run this script."
    echo ""
    read -r -p "Continue anyway? [y/N] " CONFIRM
    [[ "$CONFIRM" =~ ^[Yy]$ ]] || exit 0
fi

success "Environment configuration validated"

# ── Step 4: Crypto-wallet-manager integration ─────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}── Crypto-Wallet-Manager: Profit Monitoring Setup ──────────────${RESET}"
echo ""
echo "The built-in crypto-wallet-manager automatically monitors your wallets"
echo "and routes profits to your destination addresses after each trade."
echo ""
echo "Current configuration (from .env):"
echo "  ETH profit destination : ${ETH_PROFIT_DESTINATION:-<not set>}"
echo "  SOL profit destination : ${SOL_PROFIT_DESTINATION:-<not set>}"
echo "  Min ETH profit         : ${PROFIT_THRESHOLD_ETH:-0.001} ETH"
echo "  Min SOL profit         : ${PROFIT_THRESHOLD_SOL:-0.01} SOL"
echo "  Auto-route profits     : ${AUTO_ROUTE_PROFITS:-false}"
echo ""
echo "To enable automatic profit routing, set in .env:"
echo "  AUTO_ROUTE_PROFITS=true"
echo "  ETH_PROFIT_DESTINATION=0xYourProfitWalletAddress"
echo "  SOL_PROFIT_DESTINATION=YourSolanaProfitAddress"
echo ""
echo "See QUICKSTART.md (section 5) and EARNINGS-SETUP.md for full"
echo "crypto-wallet-manager documentation and monitoring commands."
echo ""

# ── Step 5: Health checks ─────────────────────────────────────────────────────
info "Running API health checks..."
if npx ts-node "${SCRIPT_DIR}/src/utils/health-check.ts" 2>&1 | tee -a "$LOG_FILE"; then
    success "Health checks completed"
else
    warn "Some health checks reported issues. Review the output above."
    warn "Common causes: missing API keys, network restrictions, or invalid RPC URLs."
    echo ""
    read -r -p "Continue to start the bot? [y/N] " CONFIRM
    [[ "$CONFIRM" =~ ^[Yy]$ ]] || exit 0
fi

# ── Step 6: Launch the bot ────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}All setup steps complete. Ready to start the Arbitrage Bot.${RESET}"
echo ""
echo "Logs will be written to: ${LOG_FILE}"
echo "Press Ctrl+C to stop the bot at any time."
echo ""
read -r -p "Start the bot now? [Y/n] " START
START="${START:-Y}"

if [[ "$START" =~ ^[Yy]$ ]]; then
    info "Starting Arbitrage Bot..."
    npx ts-node "${SCRIPT_DIR}/src/index.ts" 2>&1 | tee -a "$LOG_FILE"
else
    echo ""
    info "To start the bot later, run:"
    echo "  npx ts-node src/index.ts"
    echo "  # or after building:"
    echo "  npx tsc && node dist/index.js"
    echo ""
    echo "For automated deployment (non-interactive), use:"
    echo "  ./automated-deployment.sh"
fi
