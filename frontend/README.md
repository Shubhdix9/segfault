# WellChain Frontend

React + Vite frontend for the SegFault milestone-based charity donation platform.

## Features

- **Wallet Connection:** Direct integration with MetaMask via `ethers.js` (v6).
- **Presentation mode:** Switch admin, NGO, applicant, and donor roles; simulate POL and transactions without a wallet or gas.
- **IPFS documents:** Pin campaign JSON, receipt files, and proof JSON through the backend upload API.
- **Role-aware live mode:** Contract authorization controls admin, NGO, and donor actions.
- **Fast Build:** Vite powered development and build tooling.

## Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```

The app remains in presentation mode by default, even if a contract address is configured. For real IPFS uploads, configure `PINATA_MODE=pinata` and `PINATA_JWT` in `backend/.env` and run the backend. Mock mode is in-memory only. To intentionally use the live registry, set `VITE_CONTRACT_ADDRESS`, `VITE_ENABLE_LIVE_TRANSACTIONS=true`, `VITE_CHAIN_ID`, and `VITE_RPC_URL` in `.env`. Live actions submit wallet transactions and require POL for gas; demo funding and votes never do.
