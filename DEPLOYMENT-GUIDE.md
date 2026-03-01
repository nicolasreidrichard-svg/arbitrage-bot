# Deployment Guide

Complete deployment instructions for the Arbitrage Bot with security best practices.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18.x or 20.x |
| npm | 8+ |
| TypeScript | 4.x+ (installed via devDependencies) |
| OS | Linux (Ubuntu 22.04 recommended) |

---

## 1. Clone and Install

```bash
git clone https://github.com/nicolasreidrichard-svg/arbitrage-bot.git
cd arbitrage-bot
npm install
```

---

## 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys and wallet addresses
nano .env
```

See [API-INTEGRATION-GUIDE.md](API-INTEGRATION-GUIDE.md) for how to obtain each API key.

---

## 3. Verify Setup

Run the health check to confirm all APIs are reachable:

```bash
npx ts-node src/utils/health-check.ts
```

Run the earnings fetcher tests:

```bash
npx ts-node src/tests/test-earnings-fetcher.ts
```

---

## 4. Build

```bash
npx tsc
```

Compiled output will be in the `dist/` directory (if `outDir` is configured in `tsconfig.json`).

---

## 5. Run the Bot

```bash
node dist/index.js
# or in development mode:
npx ts-node src/index.ts
```

---

## 6. Automated Deployment

Use the provided script to automate setup:

```bash
chmod +x automated-deployment.sh
./automated-deployment.sh
```

The script will:
1. Check Node.js version
2. Install dependencies
3. Validate `.env` configuration
4. Run health checks
5. Run the test suite
6. Start the bot

---

## 7. Running as a Service (systemd)

Create `/etc/systemd/system/arbitrage-bot.service`:

```ini
[Unit]
Description=Arbitrage Bot
After=network.target

[Service]
Type=simple
User=arbitrage
WorkingDirectory=/opt/arbitrage-bot
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
EnvironmentFile=/opt/arbitrage-bot/.env

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable arbitrage-bot
sudo systemctl start arbitrage-bot
sudo journalctl -u arbitrage-bot -f
```

---

## 8. Security Best Practices

### Environment Variables
- Never commit `.env` to version control
- Use restrictive file permissions: `chmod 600 .env`
- Rotate API keys regularly
- Use read-only keys where write access is not needed

### Wallet Security
- Use a dedicated trading wallet, not your primary wallet
- Only fund the bot with the amount you are willing to risk
- Never enable withdrawal permissions on exchange API keys
- Whitelist your server's IP on all exchange API keys

### Server Security
- Keep the server OS and Node.js updated
- Use a firewall (UFW/iptables) – only expose ports you need
- Disable password authentication on SSH; use key-based auth
- Run the bot as a non-root user

### API Keys
- Store keys in `.env`, never in source code
- Use environment-specific keys (separate keys for dev/prod)
- Monitor API key usage for anomalies

---

## 9. Monitoring

Check logs:
```bash
tail -f combined.log
```

Run a health check at any time:
```bash
npx ts-node src/utils/health-check.ts
```

---

## 10. Updating

```bash
git pull origin main
npm install
npx tsc
sudo systemctl restart arbitrage-bot
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `Missing environment variable` | Ensure all required keys are in `.env` |
| `Etherscan API error` | Check your API key and rate limits |
| `ETH wallet not initialised` | Set `RPC_URL_1` and `WALLET_PRIVATE_KEY` in `.env` |
| Build fails | Run `npx tsc --noEmit` to see TypeScript errors |
| Webpack fails | Ensure `webpack.config.js` exists or remove the webpack CI step |
