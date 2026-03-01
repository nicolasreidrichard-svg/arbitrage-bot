# API Integration Guide

This guide explains how to obtain and configure all API keys required by the Arbitrage Bot.

---

## 1. Etherscan API Key

Used for: fetching ETH transaction history, gas price oracle.

**Steps:**
1. Go to [https://etherscan.io/register](https://etherscan.io/register) and create an account.
2. Navigate to **My Profile → API Keys**.
3. Click **Add** and give your key a name.
4. Copy the generated key.

**.env configuration:**
```env
ETHERSCAN_API_KEY=your-etherscan-api-key
ETH_ADDRESS=0x08143f357d31Ec0D38B40eB383fC3450410c5CC7
```

**Free tier limits:** 5 calls/second, 100,000 calls/day.

---

## 2. Solscan Pro API Key

Used for: fetching Solana transaction history.

**Steps:**
1. Go to [https://pro.solscan.io/](https://pro.solscan.io/) and sign in.
2. Navigate to **API** in your account dashboard.
3. Create a new API key.
4. Copy the token.

**.env configuration:**
```env
SOLSCAN_API_KEY=your-solscan-api-key
SOL_ADDRESS=D1DYRrJqfuTnuTszWtv3nHChCcanGm7Q1eF2GUUQ2r3
```

---

## 3. Helius API Key (Solana RPC + Priority Fees)

Used for: Solana RPC access and priority fee estimation.

**Steps:**
1. Go to [https://www.helius.dev/](https://www.helius.dev/) and create an account.
2. Create a new project in the dashboard.
3. Copy the API key.

**.env configuration:**
```env
HELIUS_API_KEY=your-helius-api-key
```

---

## 4. Binance API Key

Used for: price feeds, order placement on Binance.

**Steps:**
1. Log in to [https://www.binance.com](https://www.binance.com).
2. Go to **My Account → API Management**.
3. Click **Create API**, give it a label, and complete 2FA.
4. Enable **Spot & Margin Trading** permission.
5. Whitelist your server's IP address for security.
6. Copy both the API Key and Secret Key.

**.env configuration:**
```env
BINANCE_API_KEY=your-binance-api-key
BINANCE_API_SECRET=your-binance-api-secret
BINANCE_MAX_ORDER_USD=10000
```

> **Security**: Never enable withdrawal permissions on trading API keys.

---

## 5. Coinbase Advanced Trade API Key

Used for: price feeds, order placement on Coinbase.

**Steps:**
1. Log in to [https://www.coinbase.com](https://www.coinbase.com).
2. Navigate to **Settings → API**.
3. Click **New API Key**.
4. Select **trading** permissions (View + Trade).
5. Copy the Key, Secret, and Passphrase.

**.env configuration:**
```env
COINBASE_API_KEY=your-coinbase-api-key
COINBASE_API_SECRET=your-coinbase-api-secret
COINBASE_PASSPHRASE=your-coinbase-passphrase
COINBASE_MAX_ORDER_USD=10000
```

---

## 6. Ethereum RPC Provider

Used for: connecting to the Ethereum network for on-chain reads and transaction submission.

Recommended providers:
- [Alchemy](https://www.alchemy.com/) – generous free tier
- [Infura](https://infura.io/) – reliable, widely used
- [QuickNode](https://www.quicknode.com/) – fast nodes

**Steps (Alchemy example):**
1. Create an account at [https://www.alchemy.com/](https://www.alchemy.com/).
2. Create a new App targeting **Ethereum Mainnet**.
3. Copy the HTTPS endpoint URL.

**.env configuration:**
```env
RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/your-key
RPC_URL_2=https://mainnet.infura.io/v3/your-key   # fallback
```

---

## 7. Uniswap Subgraph (optional)

Used for: querying Uniswap V3 pool prices via The Graph.

No API key required for the public endpoint. For production workloads, use a dedicated hosted service or a private Graph Node.

**.env configuration:**
```env
UNISWAP_SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3
UNISWAP_ROUTER_ADDRESS=0xE592427A0AEce92De3Edee1F18E0157C05861564
```

---

## API Key Security Checklist

- [ ] Store all API keys in `.env` — never hardcode them in source files
- [ ] Add `.env` to `.gitignore`
- [ ] Disable withdrawal permissions on exchange API keys
- [ ] Whitelist your server's IP where the exchange allows it
- [ ] Rotate keys periodically
- [ ] Use read-only keys where write access is not required
