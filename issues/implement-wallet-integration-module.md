# Issue Title
Implement Wallet Integration Module

# Body
Build wallet integration to manage bot assets, balance monitoring, and transaction signing.

## Acceptance Criteria:
- Load wallet from private key or HD seed
- Monitor wallet balance in real-time
- Support transaction signing and broadcast
- Track pending/confirmed transactions
- Multi-chain wallet support (start with Ethereum)
- Secure key management (encrypted storage)
- Unit tests for wallet operations.

## Implementation Details:
- Create `src/modules/walletManager.ts`
- Use ethers.js for Web3 interactions
- Implement balance polling service
- Store encrypted private keys (use environment variables for now)
- Create Wallet interface with key methods