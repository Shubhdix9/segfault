# AquaChain (SegFault)

A 100% decentralized Web3 charity donation platform powered by smart contracts and IPFS. Donors directly vote on milestone receipts on-chain, eliminating intermediaries and guaranteeing that funds are released only when genuine progress is verified.

---

## Core Web3 Architecture

This project is built strictly on decentralized Web3 protocols without centralized servers, off-chain databases, or traditional web2 APIs:

- **Smart Contracts (`charityregistry/contracts/CharityRegistry.sol`):** 
  - Handles campaign creation with milestone allocations and optional seed advances.
  - Whitelists verified NGO wallet addresses (`authorizeNGO`, `revokeNGO`).
  - Holds donor contributions in escrow on Polygon Amoy.
  - Manages milestone proof-of-work status (`Pending`, `ProofSubmitted`, `Approved`, `Rejected`, `Disbursed`).
  - Conducts 24-hour weighted donor voting and trustless automated payouts (`finalizeMilestone`).
- **Decentralized Storage (`ipfs/pinata.js`):** 
  - Pins campaign narratives, metadata JSON, and milestone expenditure receipts/invoices directly to IPFS via the Pinata Gateway.
  - Generates verifiable IPFS CIDs (`bafy...`) linked on-chain to each milestone.
- **Web3 Frontend (`AquaChain.html`):** 
  - Client-side decentralized application connecting directly to MetaMask (`ethers.js` on Polygon Amoy).
  - Dynamically switches between public donor views and the `/admin` portal (Admin Platform + NGO Dashboard).

---

## How It Works

```text
  [ NGO ]                                   [ Donors ]
     │                                          │
     ├─► 1. Creates Campaign on-chain          ├─► 2. Back with POL (1 POL = 1 Vote)
     │      (Metadata JSON pinned to IPFS)      │
     │                                          │
     ├─► 3. Uploads Expense Receipt             │
     │      (Pinned to Pinata IPFS)             │
     │                                          ├─► 4. Review IPFS Receipt & Vote
     │                                          │
     ▼                                          ▼
 ╔══════════════════════════════════════════════════════════════╗
 ║                   CharityRegistry.sol                        ║
 ║  • Quorum check: >50% affirmative weighted votes             ║
 ║  • Auto-releases milestone payout directly to NGO wallet     ║
 ╚══════════════════════════════════════════════════════════════╝
```

---

## Access & Panels

- **Public Site (`#explore`, `#portfolio`):**
  - **Campaigns:** Browse open charity campaigns and donate POL.
  - **Donor Dashboard:** View contributed campaigns, inspect store receipts on IPFS, and vote on active milestones.
- **Management Portal (`/admin`):**
  - **Admin Platform:** Whitelist NGO wallet addresses on `CharityRegistry`, pause/resume campaigns, inspect donor flags, and configure contract/Pinata IPFS settings.
  - **NGO Dashboard:** Start milestone-based campaigns, claim unlocked seed advances, and upload invoice receipts to Pinata IPFS.

---

## Connecting Live Contracts & IPFS to the Frontend

1. Open **`AquaChain.html#admin`** (or `/admin`) in your browser.
2. In the **Web3 & IPFS Live Integration** card:
   - **CharityRegistry Contract Address:** Paste your deployed contract address on Polygon Amoy.
   - **Pinata IPFS JWT:** Paste your Pinata API JWT token.
   - Click **Save & Connect**.
3. All receipt uploads will pin to Pinata IPFS and record on `CharityRegistry.sol`.
