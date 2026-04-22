---
layout: default
title: Charm
description: Uniswap v3 Spot Bot on Base (Node.js) — part of the ARC Trading Fleet.
---

# Charm
**Uniswap v3 Spot Bot on Base (Node.js)**

[![Source](https://img.shields.io/badge/source-GitHub-181717?logo=github)](https://github.com/GareBear99/Charm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/GareBear99/Charm/blob/main/LICENSE)
[![Built on ARC-Core](https://img.shields.io/badge/built%20on-ARC--Core-5B6CFF)](https://github.com/GareBear99/ARC-Core)

## What this is

Charm is part of the **ARC Trading Fleet** — six public repositories that share a
single event-and-receipt doctrine provided by
[ARC-Core](https://github.com/GareBear99/ARC-Core).

- **Source code and full README**: [https://github.com/GareBear99/Charm](https://github.com/GareBear99/Charm)
- **Architecture notes**: [docs/ARCHITECTURE.md](https://github.com/GareBear99/Charm/blob/main/docs/ARCHITECTURE.md)
- **Usage / operator guide**: [docs/USAGE.md](https://github.com/GareBear99/Charm/blob/main/docs/USAGE.md)
- **Security policy**: [SECURITY.md](https://github.com/GareBear99/Charm/blob/main/SECURITY.md)
- **Contributing**: [CONTRIBUTING.md](https://github.com/GareBear99/Charm/blob/main/CONTRIBUTING.md)

## ARC-Core mapping

Every market tick becomes an *event*; every trade decision becomes a *proposal*;
every fill or outcome becomes a *receipt*; every risk limit is an *authority
gate*; every backtest is a *deterministic replay* of the event log. Full per-bot
mapping in [ECOSYSTEM.md](https://github.com/GareBear99/ARC-Core/blob/main/ECOSYSTEM.md#-trading-fleet--six-repos-one-event-spine).

## Sibling repos in the fleet

| Repo | One-liner | Docs site |
|---|---|---|
| [BrokeBot](https://github.com/GareBear99/BrokeBot) | TRON Funding-Rate Arbitrage (CEX, Python) | [https://garebear99.github.io/BrokeBot/](https://garebear99.github.io/BrokeBot/) |
| [Harvest](https://github.com/GareBear99/Harvest) | Multi-Timeframe Crypto Research Platform (Python) | [https://garebear99.github.io/Harvest/](https://garebear99.github.io/Harvest/) |
| [One-Shot-Multi-Shot](https://github.com/GareBear99/One-Shot-Multi-Shot) | Binary-Options 3-Hearts Engine (JS) | [https://garebear99.github.io/One-Shot-Multi-Shot/](https://garebear99.github.io/One-Shot-Multi-Shot/) |
| [DecaGrid](https://github.com/GareBear99/DecaGrid) | Capital-Ladder Grid Trading Docs Pack | [https://garebear99.github.io/DecaGrid/](https://garebear99.github.io/DecaGrid/) |
| [EdgeStack Currency](https://github.com/GareBear99/EdgeStack_Currency) | Event-Sourced Multi-Currency Execution Spec | [https://garebear99.github.io/EdgeStack_Currency/](https://garebear99.github.io/EdgeStack_Currency/) |

## Upstream

- [ARC-Core](https://github.com/GareBear99/ARC-Core) — the event + receipt spine.
- [omnibinary-runtime](https://github.com/GareBear99/omnibinary-runtime) — any-OS runtime.
- [Arc-RAR](https://github.com/GareBear99/Arc-RAR) — archives + rollback.
- [Portfolio](https://github.com/GareBear99/Portfolio) — full project index.

---
*This page is auto-rendered from `docs/index.md` on the `main` branch. The
canonical source of truth is the repository README.*
