#!/usr/bin/env bash
# setup.sh
# Final setup script for the Arbitrage Bot.
# Guides users through configuring API keys and wallet addresses,
# verifies the environment, and launches the bot.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}=================================================${NC}"
echo -e "${CYAN}        Arbitrage Bot – Final Setup Script       ${NC}"
echo -e "${CYAN}=================================================${NC}"
echo ""

# ── Security Reminders ────────────────────────────────────────────────────────
echo -e "${YELLOW}╔══════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║           ⚠  SECURITY REMINDERS  ⚠           ║${NC}"
echo -e "${YELLOW}╠══════════════════════════════════════════════╣${NC}"
echo -e "${YELLOW}║  • NEVER commit your .env file to git        ║${NC}"
echo -e "${YELLOW}║  • NEVER share your private keys or secrets  ║${NC}"
echo -e "${YELLOW}║  • Use a dedicated trading wallet only       ║${NC}"
echo -e "${YELLOW}║  • Only fund the bot with money you can risk ║${NC}"
echo -e "${YELLOW}║  • Use read-only exchange keys where possible║${NC}"
echo -e "${YELLOW}║  • Whitelist your server IP on exchange APIs ║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: Check Node.js ─────────────────────────────────────────────────────
info "Step 1/6 – Checking Node.js version..."
MIN_NODE=18
if ! command -v node &>/dev/null; then
    error "Node.js is not installed. Please install Node.js ${MIN_NODE}+. See https://nodejs.org"
fi
NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_VER" -lt "$MIN_NODE" ]; then
    error "Node.js ${MIN_NODE}+ is required. Found: $(node --version)"
fi
success "Node.js $(node --version) detected."

# ── Step 2: Install dependencies ─────────────────────────────────────────────
info "Step 2/6 – Installing dependencies..."
cd "$SCRIPT_DIR"
npm install --silent
success "Dependencies installed."

# ── Step 3: Configure .env ────────────────────────────────────────────────────
info "Step 3/6 – Configuring environment variables..."

ENV_FILE="${SCRIPT_DIR}/.env"

if [ ! -f "$ENV_FILE" ]; then
    cp "${SCRIPT_DIR}/.env.example" "$ENV_FILE"
    info "Created .env from .env.example."
    echo ""
    echo -e "${YELLOW}  Fill in the placeholders below before the bot can start.${NC}"
    echo -e "${YELLOW}  Edit ${ENV_FILE} and replace every value that starts with${NC}"
    echo -e "${YELLOW}  'your-' or '0xYour' with your actual credentials.${NC}"
    echo ""
    echo -e "  ${CYAN}Key variables to configure:${NC}"
    echo "    WALLET_ADDRESS        – Your Ethereum wallet address"
    echo "    WALLET_PRIVATE_KEY    – Your Ethereum private key  ⚠  keep secret"
    echo "    ETH_ADDRESS           – Ethereum address to track"
    echo "    SOL_ADDRESS           – Solana address to track"
    echo "    ETHERSCAN_API_KEY     – From https://etherscan.io/myapikey"
    echo "    SOLSCAN_API_KEY       – From https://pro.solscan.io/"
    echo "    HELIUS_API_KEY        – From https://www.helius.dev/"
    echo "    BINANCE_API_KEY       – From https://www.binance.com/en/my/settings/api-management"
    echo "    BINANCE_API_SECRET    – (same page as above)"
    echo "    COINBASE_API_KEY      – From https://www.coinbase.com/settings/api"
    echo "    COINBASE_API_SECRET   – (same page as above)"
    echo "    RPC_URL_1             – Ethereum JSON-RPC endpoint (e.g. Infura / Alchemy)"
    echo ""
    echo -e "  ${CYAN}Wallet Manager Integration:${NC}"
    echo "    For advanced wallet management, see the crypto-wallet-manager repo:"
    echo "    https://github.com/nicolasreidrichard-svg/crypto-wallet-manager"
    echo ""
    echo -e "${YELLOW}  Re-run this script once .env is filled in.${NC}"
    echo ""
    exit 0
fi

# ── Step 4: Verify required environment variables ─────────────────────────────
info "Step 4/6 – Verifying environment variables..."

# shellcheck source=/dev/null
source "$ENV_FILE"

REQUIRED_VARS=(
    "WALLET_ADDRESS"
    "ETH_ADDRESS"
    "SOL_ADDRESS"
    "ETHERSCAN_API_KEY"
    "BINANCE_API_KEY"
    "BINANCE_API_SECRET"
    "RPC_URL_1"
)

PLACEHOLDER_PATTERNS=("your-" "0xYour" "your_" "YOUR_")

MISSING=()
UNSET=()

for var in "${REQUIRED_VARS[@]}"; do
    val="${!var:-}"
    if [ -z "$val" ]; then
        UNSET+=("$var")
        continue
    fi
    for pattern in "${PLACEHOLDER_PATTERNS[@]}"; do
        if [[ "$val" == *"$pattern"* ]]; then
            MISSING+=("$var  (still contains placeholder value)")
            break
        fi
    done
done

if [ "${#UNSET[@]}" -gt 0 ]; then
    warn "The following required variables are not set in .env:"
    for v in "${UNSET[@]}"; do
        echo "    - $v"
    done
fi

if [ "${#MISSING[@]}" -gt 0 ]; then
    warn "The following variables still contain placeholder values:"
    for v in "${MISSING[@]}"; do
        echo "    - $v"
    done
fi

if [ "${#UNSET[@]}" -gt 0 ] || [ "${#MISSING[@]}" -gt 0 ]; then
    echo ""
    warn "Please update ${ENV_FILE} and re-run this script."
    warn "See API-INTEGRATION-GUIDE.md for instructions on obtaining each key."
    warn "For wallet setup, visit: https://github.com/nicolasreidrichard-svg/crypto-wallet-manager"
    echo ""
    exit 1
fi

success "All required environment variables are set."

# ── Step 5: Run health checks ─────────────────────────────────────────────────
info "Step 5/6 – Running API health checks..."
if npx ts-node "${SCRIPT_DIR}/src/utils/health-check.ts"; then
    success "Health checks passed."
else
    warn "Some health checks failed. The bot may have limited functionality."
    warn "Check your API keys and network connectivity, then re-run."
fi

# ── Step 6: Launch the bot ────────────────────────────────────────────────────
info "Step 6/6 – Starting the Arbitrage Bot..."
echo ""
success "Setup complete. Launching bot. Press Ctrl+C to stop."
echo ""

npx ts-node "${SCRIPT_DIR}/src/index.ts"
