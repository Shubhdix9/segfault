# SegFault

A blockchain-based charity donation platform that uses milestone-based fund releases and publicly verifiable transactions.

---

## Planned Technology Stack

- **Smart Contracts:** Solidity, Hardhat, OpenZeppelin
- **Frontend:** React, Vite, ethers.js, MetaMask
- **Backend & Storage:** Supabase (PostgreSQL), Express, IPFS

---

## Project Structure

```text
SegFault/
├── contracts/          # Hardhat development environment & OpenZeppelin contracts
│   ├── contracts/      # Solidity smart contracts
│   ├── test/           # Mocha & Solidity tests
│   ├── hardhat.config.ts
│   └── package.json
├── frontend/           # React + Vite Web3 frontend
│   ├── src/            # App, Ethereum provider (ethers.js), Supabase client
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── backend/            # Express API & Supabase database schema
│   ├── src/            # API server & Supabase client
│   ├── supabase/       # SQL migrations & schema (schema.sql)
│   └── package.json
├── .gitignore          # Root Git ignore configuration
└── README.md           # Project documentation
```

---

## Getting Started

### 1. Smart Contracts

```bash
cd contracts
npm run compile
npm run test
```

### 2. Frontend Application

```bash
cd frontend
cp .env.example .env
npm run dev
```

### 3. Backend & Supabase Service

```bash
cd backend
cp .env.example .env
npm run dev
```

Apply the database schema in Supabase using [`backend/supabase/schema.sql`](file:///D:/Projects/segfault/backend/supabase/schema.sql).
