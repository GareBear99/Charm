<!-- ARC-Ecosystem-Hero-Marker -->
# Charm — Uniswap v3 Spot Bot on Base ($≤12 accounts)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node 18+](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org/)
[![Network: Base](https://img.shields.io/badge/network-Base-0052FF)](https://base.org/)
[![Built on ARC-Core](https://img.shields.io/badge/built%20on-ARC--Core-5B6CFF)](https://github.com/GareBear99/ARC-Core)

> Autonomous ETH/USDC spot bot on **Base** using **Uniswap v3**. Designed for
> *dedicated-wallet micro-accounts* (≤ $12) with mean-reversion bands, QuoterV2
> slippage protection, and strict per-session trade + loss caps.

## Why you might read this repo

-   **Honest scope**: tiny account, tiny risk, hard capital cap — no hype.
-   **Safe wallet pattern**: never uses your main MetaMask; bot trades from a
    dedicated, low-balance address whose key lives in `.env` only.
-   **Uniswap v3 done right**: QuoterV2 + `amountOutMinimum` with slippage
    buffer, cooldowns between trades, single-position constraint.
-   **Contracts documented**: WETH / USDC / pool / QuoterV2 / SwapRouter02 /
    Factory addresses included for auditability.

## Part of the ARC ecosystem

Charm is the on-chain sibling of [BrokeBot](https://github.com/GareBear99/BrokeBot)
(CEX funding-rate). Both can be wired to the **ARC-Core** event spine for
receipts + replay:

-   [ARC-Core](https://github.com/GareBear99/ARC-Core)
-   [omnibinary-runtime](https://github.com/GareBear99/omnibinary-runtime) +
    [Arc-RAR](https://github.com/GareBear99/Arc-RAR) — any-OS portability.
-   [Portfolio](https://github.com/GareBear99/Portfolio) — full project index.

## Keywords
`uniswap v3 bot` · `base chain bot` · `defi trading bot` · `ethers.js bot` ·
`mean reversion` · `slippage protection` · `dedicated bot wallet` ·
`on-chain trading` · `micro-account` · `metamask` · `nodejs`

---

# Charm Extension (Base / Uniswap v3) — $≤12 Spot Bot

This package runs an **autonomous** ETH<->USDC spot bot on **Base** using **Uniswap v3**.
It is designed for **small accounts** and enforces a **hard capital cap** (default: $12).

## Important: MetaMask + Autonomy
MetaMask is best used to **fund a dedicated bot wallet** (new address) with **≤ $12**.
The bot then trades from that wallet using an RPC provider. This is the normal way to run
autonomous bots without fragile browser-extension automation.

## What it does
- Samples the **Uniswap v3 WETH/USDC 0.05% pool** price on Base.
- Computes rolling mean + stdev bands.
- Buys WETH with USDC when price is **low** (below lower band) and cooldown allows.
- Sells WETH back to USDC when price is **high** (above upper band) and cooldown allows.
- Uses Uniswap **QuoterV2** to compute `amountOutMinimum` with a slippage buffer.
- Enforces strict safety limits:
  - single position at a time
  - max trades per session
  - stop after consecutive losses
  - halts if total value exceeds cap

## Requirements
- Node.js 18+
- A Base RPC URL (default Base public RPC works)
- A **dedicated bot wallet private key** funded on Base

## Setup
```bash
cd charm-extension-bot
npm install
cp .env.example .env
# edit .env with your BOT_PRIVATE_KEY and optional params
npm run start
```

### Dry run (no transactions)
```bash
npm run dryrun
```

## Funding (MetaMask)
1) In MetaMask, add **Base** network.
2) Bridge USDC to Base.
3) Send **≤ $12 USDC** to your bot wallet address.

## Notes
- This is **probabilistic**. There is no guarantee to double $10 in 48h.
- Do not run this with your main wallet.
- Start with DRY_RUN to confirm pricing + signals.

## Addresses (Base)
- WETH: 0x4200000000000000000000000000000000000006
- USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
- Uniswap v3 WETH/USDC 0.05% pool: 0xd0b53D9277642d899DF5C87A3966A349A798F224
- Uniswap QuoterV2: 0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a
- Uniswap SwapRouter02: 0x2626664c2603336E57B271c5C0b26F421741e481
- Uniswap V3 Factory: 0x33128a8fC17869897dcE68Ed026d694621f6FDfD
