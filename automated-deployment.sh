#!/usr/bin/env bash
# automated-deployment.sh
# Automates setup and deployment of the Arbitrage Bot.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/deployment.log"
MIN_NODE_VERSION=18

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
    echo "$msg" | tee -a "$LOG_FILE"
}

error() {
    log "ERROR: $*" >&2
    exit 1
}

# ── Step 1: Check Node.js version ────────────────────────────────────────────
log "Checking Node.js version..."
if ! command -v node &>/dev/null; then
    error "Node.js is not installed. Please install Node.js ${MIN_NODE_VERSION}+."
fi

NODE_VERSION=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_VERSION" -lt "$MIN_NODE_VERSION" ]; then
    error "Node.js ${MIN_NODE_VERSION}+ is required. Found: ${NODE_VERSION}"
fi
log "Node.js version: $(node --version) ✓"

# ── Step 2: Install dependencies ─────────────────────────────────────────────
log "Installing dependencies..."
cd "$SCRIPT_DIR"
npm install 2>&1 | tee -a "$LOG_FILE"
log "Dependencies installed ✓"

# ── Step 3: Validate .env ────────────────────────────────────────────────────
log "Validating environment configuration..."

if [ ! -f "${SCRIPT_DIR}/.env" ]; then
    log "No .env file found. Copying from .env.example..."
    cp "${SCRIPT_DIR}/.env.example" "${SCRIPT_DIR}/.env"
    log "Created .env from template. Please fill in your API keys before proceeding."
    log "Edit ${SCRIPT_DIR}/.env and re-run this script."
    exit 0
fi

# Check required variables
REQUIRED_VARS=(
    "ETH_ADDRESS"
    "SOL_ADDRESS"
)

MISSING=()
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/.env"
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
        MISSING+=("$var")
    fi
done

if [ "${#MISSING[@]}" -gt 0 ]; then
    log "WARNING: The following environment variables are not set:"
    for v in "${MISSING[@]}"; do
        log "  - $v"
    done
    log "The bot will use default addresses. Set these variables for production use."
fi

log "Environment configuration validated ✓"

# ── Step 4: Run health checks ─────────────────────────────────────────────────
log "Running API health checks..."
if npx ts-node "${SCRIPT_DIR}/src/utils/health-check.ts" 2>&1 | tee -a "$LOG_FILE"; then
    log "Health checks completed ✓"
else
    log "WARNING: Some health checks failed. Check the log for details."
fi

# ── Step 5: Run test suite ────────────────────────────────────────────────────
log "Running earnings fetcher tests..."
if npx ts-node "${SCRIPT_DIR}/src/tests/test-earnings-fetcher.ts" 2>&1 | tee -a "$LOG_FILE"; then
    log "Tests passed ✓"
else
    error "Tests failed. Fix the issues above before deploying."
fi

# ── Step 6: Build TypeScript ──────────────────────────────────────────────────
log "Building TypeScript..."
if npx tsc --noEmit 2>&1 | tee -a "$LOG_FILE"; then
    log "TypeScript compilation successful ✓"
else
    error "TypeScript compilation failed."
fi

# ── Step 7: Start the bot ─────────────────────────────────────────────────────
log "All checks passed. Starting the Arbitrage Bot..."
log "Logs will be written to: ${LOG_FILE} and combined.log"
log "Press Ctrl+C to stop."

npx ts-node "${SCRIPT_DIR}/src/index.ts" 2>&1 | tee -a "$LOG_FILE"
