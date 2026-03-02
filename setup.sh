#!/usr/bin/env bash
# setup.sh
# Final setup script for the Arbitrage Bot.
# Guides you through configuring API keys and wallet addresses,
# validates environment variables, and launches the bot.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo -e "${BOLD}"
echo "=============================================="
echo "   Arbitrage Bot – Final Setup Script"
echo "=============================================="
echo -e "${NC}"

# ── Security Reminders ────────────────────────────────────────────────────────
echo -e "${YELLOW}${BOLD}⚠  SECURITY REMINDERS – please read before continuing${NC}"
echo "  • Never commit your .env file to version control."
echo "  • Use a dedicated trading wallet, NOT your primary wallet."
echo "  • Only fund the bot with an amount you are willing to risk."
echo "  • Never enable withdrawal permissions on exchange API keys."
echo "  • Restrict API key IP access to your server's address."
echo "  • Keep WALLET_PRIVATE_KEY and API secrets out of chat logs,"
echo "    screenshots, and issue trackers."
echo ""

# ── Wallet Manager Integration ────────────────────────────────────────────────
echo -e "${CYAN}${BOLD}ℹ  Wallet Management (crypto-wallet-manager)${NC}"
echo "  For advanced wallet features (HD wallets, encrypted key storage,"
echo "  multi-chain balance monitoring) see the companion repository:"
echo ""
echo "    https://github.com/nicolasreidrichard-svg/crypto-wallet-manager"
echo ""
echo "  Clone it alongside this repo and follow its README to set up"
echo "  wallet management before running the bot in production."
echo ""

# ── Step 1: Check Node.js ─────────────────────────────────────────────────────
info "Checking Node.js version..."
if ! command -v node &>/dev/null; then
    error "Node.js is not installed. Please install Node.js 18 or later."
fi
NODE_VERSION=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js 18+ is required. Found: $(node --version)"
fi
success "Node.js $(node --version)"

# ── Step 2: Install dependencies ──────────────────────────────────────────────
info "Installing dependencies..."
cd "$SCRIPT_DIR"
npm install --silent
success "Dependencies installed"

# ── Step 3: Configure .env ────────────────────────────────────────────────────
info "Checking environment configuration..."

if [ ! -f "${SCRIPT_DIR}/.env" ]; then
    cp "${SCRIPT_DIR}/.env.example" "${SCRIPT_DIR}/.env"
    warn ".env not found – created from .env.example."
    echo ""
    echo -e "${BOLD}  ACTION REQUIRED${NC}"
    echo "  Open ${SCRIPT_DIR}/.env in your editor and replace every"
    echo "  placeholder value with your real API keys and wallet addresses:"
    echo ""
    echo "    nano ${SCRIPT_DIR}/.env"
    echo ""
    echo "  Key variables to fill in:"
    echo "    WALLET_ADDRESS       – your Ethereum trading wallet address"
    echo "    WALLET_PRIVATE_KEY   – private key for that wallet (keep secret!)"
    echo "    ETH_ADDRESS          – Ethereum address for earnings tracking"
    echo "    SOL_ADDRESS          – Solana address for earnings tracking"
    echo "    ETHERSCAN_API_KEY    – from https://etherscan.io/myapikey"
    echo "    SOLSCAN_API_KEY      – from https://pro.solscan.io/"
    echo "    HELIUS_API_KEY       – from https://www.helius.dev/"
    echo "    BINANCE_API_KEY / BINANCE_API_SECRET"
    echo "    COINBASE_API_KEY / COINBASE_API_SECRET"
    echo "    RPC_URL_1            – Ethereum RPC endpoint"
    echo ""
    echo "  After editing, run this script again: ./setup.sh"
    echo ""
    echo "  See API-INTEGRATION-GUIDE.md for instructions on obtaining each key."
    exit 0
fi

# ── Step 4: Validate environment variables ────────────────────────────────────
info "Validating environment variables..."

# Load .env (ignore lines that are comments or blank)
# shellcheck source=/dev/null
set -o allexport
source "${SCRIPT_DIR}/.env"
set +o allexport

REQUIRED_VARS=(
    "WALLET_ADDRESS"
    "WALLET_PRIVATE_KEY"
    "ETH_ADDRESS"
    "SOL_ADDRESS"
    "RPC_URL_1"
    "ETHERSCAN_API_KEY"
    "BINANCE_API_KEY"
    "BINANCE_API_SECRET"
)

PLACEHOLDER_PATTERN="^your-|^0xYour|^YourSolana"

MISSING=()
UNFILLED=()

for var in "${REQUIRED_VARS[@]}"; do
    val="${!var:-}"
    if [ -z "$val" ]; then
        MISSING+=("$var")
    elif echo "$val" | grep -qiE "$PLACEHOLDER_PATTERN"; then
        UNFILLED+=("$var")
    fi
done

if [ "${#MISSING[@]}" -gt 0 ]; then
    warn "The following required variables are not set in .env:"
    for v in "${MISSING[@]}"; do
        echo "    - $v"
    done
fi

if [ "${#UNFILLED[@]}" -gt 0 ]; then
    warn "The following variables still contain placeholder values:"
    for v in "${UNFILLED[@]}"; do
        echo "    - $v"
    done
fi

if [ "${#MISSING[@]}" -gt 0 ] || [ "${#UNFILLED[@]}" -gt 0 ]; then
    echo ""
    echo "  Edit ${SCRIPT_DIR}/.env, replace the placeholders, then re-run: ./setup.sh"
    echo "  See API-INTEGRATION-GUIDE.md for instructions on obtaining each key."
    exit 1
fi

success "All required environment variables are set"

# ── Step 5: Enforce .env file permissions ─────────────────────────────────────
chmod 600 "${SCRIPT_DIR}/.env"
success ".env file permissions set to 600 (owner read/write only)"

# ── Step 6: Run health checks ─────────────────────────────────────────────────
info "Running API health checks..."
if npx ts-node "${SCRIPT_DIR}/src/utils/health-check.ts"; then
    success "Health checks passed"
else
    warn "Some health checks failed – check your API keys and network connectivity."
    echo "  The bot will still start but some integrations may not work."
fi

# ── Step 7: Launch the bot ────────────────────────────────────────────────────
echo ""
success "Setup complete. Launching the Arbitrage Bot..."
echo "  Press Ctrl+C to stop."
echo ""

npx ts-node "${SCRIPT_DIR}/src/index.ts"
