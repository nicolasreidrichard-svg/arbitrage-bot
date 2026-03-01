// config/default.ts
// Default configuration values for the arbitrage bot.
// Override via environment variables (see .env.example).

const config = {
  monitoringInterval: Number(process.env.MONITORING_INTERVAL) || 5000,
  rpcUrls: [
    process.env.RPC_URL_1 || '',
    process.env.RPC_URL_2 || '',
  ],
  dexRouters: [
    process.env.DEX_ROUTER_1 || '',
    process.env.DEX_ROUTER_2 || '',
  ],
  wallet: {
    address: process.env.WALLET_ADDRESS || '',
    privateKey: process.env.WALLET_PRIVATE_KEY || '',
  },
  api: {
    key: process.env.API_KEY || '',
    secret: process.env.API_SECRET || '',
  },
};

/**
 * Validates that all required configuration values are present.
 * Call this at application startup before the bot begins operating.
 */
export function validateConfig(): void {
  const required: Array<{ name: string; value: string }> = [
    { name: 'RPC_URL_1', value: config.rpcUrls[0] },
    { name: 'RPC_URL_2', value: config.rpcUrls[1] },
    { name: 'DEX_ROUTER_1', value: config.dexRouters[0] },
    { name: 'DEX_ROUTER_2', value: config.dexRouters[1] },
    { name: 'WALLET_ADDRESS', value: config.wallet.address },
    { name: 'WALLET_PRIVATE_KEY', value: config.wallet.privateKey },
    { name: 'API_KEY', value: config.api.key },
    { name: 'API_SECRET', value: config.api.secret },
  ];

  const missing = required.filter((r) => !r.value).map((r) => r.name);
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}

export default config;
