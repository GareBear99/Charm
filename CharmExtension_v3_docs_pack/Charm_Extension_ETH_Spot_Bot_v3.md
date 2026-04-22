# Charm Extension — ETH Spot Buy-Low / Sell-High Bot (MetaMask Compatible) — v2

**Date:** 2025-12-29  
**Goal:** Grow small capital responsibly by trading only **range-bound ETH/USDC** conditions.  
**Scope:** Spot only (no leverage). Layer-2 networks (Base preferred).

---

## Purpose

Charm Extension is a calculated on-chain Ethereum spot bot designed to operate through MetaMask on L2.
It seeks probabilistic gains from short-term mean reversion (buy-low/sell-high) using strict **trade windows** and **kill-switches**.

---

## Paper-to-Live Safety Gate (Mandatory)

Before **any live trading / live LP deployment**, the bot must run in **paper mode** first.

**Requirements to unlock live mode:**
1) **24 hours of continuous paper trading runtime** (rolling, pauses allowed only for bot restarts < 5 minutes total).
2) **At least 1 closed paper trade with net positive PnL** (after estimated fees + slippage).
3) If paper mode has **2 losses in a row**, the bot must extend paper mode until it achieves **1 net-positive trade** again.
4) When live mode unlocks, enable it for **one session only**, then require paper mode again after:
   - a daily drawdown stop, OR
   - any critical error/restart, OR
   - 24 hours since last paper qualification

**Why:** This prevents “turning on live” during a bad regime or broken config.

---

## Network & Infrastructure

- **Networks:** Base (preferred), Arbitrum, Optimism  
- **Wallet:** MetaMask  
- **DEX:** Uniswap v3 or Aerodrome  
- **Pair:** ETH / USDC  
- **Gas budget:** keep < $0.50 per session target (adjust for congestion)

---

## Market Conditions (Must Pass)

Trade only if **all** are true:

1) **Range-bound regime:** No clear trend (flat EMA slope)  
2) **24h volatility:** under ~4% (configurable)  
3) **No major macro news window:** do not start a new session in high-impact windows  
4) **Compression:** declining volume and/or ATR contracting

If any condition fails → **No trade window opens**.

---

## Indicators Used

- VWAP (session)
- VWAP ± 1.5 standard deviation bands
- EMA 20 (5m)
- ATR 14 (5m)
- Volume (5m) vs volume moving averages

---

## Trade Window Definition (Open / Closed)

A **trade window is OPEN** only when:
- Market conditions pass (above), **and**
- A valid mean-reversion setup is confirmed (below)

A **trade window is CLOSED** when:
- Market regime fails, **or**
- Volatility expands (ATR rising), **or**
- An “expansion candle” occurs (breakout), **or**
- The setup expires (stale signal)

---

## Buy Logic (Buy Low)

Open **BUY window** when all are true:

1) Price touches **VWAP − 1.5σ**
2) Candle closes back **inside** the band (reclaim)
3) ATR is **decreasing**
4) No expansion candle present in recent lookback

Enter only while the BUY window is open.

---

## Sell Logic (Sell High)

Open **SELL window** when all are true:

1) Price touches **VWAP + 1.5σ**
2) Rejection candle forms / closes back inside band
3) Volume spike on rejection
4) ATR is **decreasing**

Enter only while the SELL window is open.

---

## Risk Management

- Spot only (no leverage)
- Single direction exposure at a time (avoid stacking the same side)
- Stop-loss: **-3%** (configurable)
- Maximum **3 trades per session**
- Stop after **2 losses** (hard daily/session guard)

---

## Profit Lock

- If account balance reaches the configured goal (e.g., **$20**), exit to USDC
- Disable bot for **24 hours**

---

## Multi-Personality Slot Model (v3)

The bot maintains **3 concurrent slots**, each with a distinct role. Slots do **not** force trades; they consume the same validated trade windows with different urgency and sizing.

All slots share the same **global safety gates**:
- Market regime gate (range-bound + volatility limits)
- Trade window open/close logic (VWAP band confirmation)
- Paper-to-Live qualification gate
- Daily drawdown + cooldown rules
- No same-direction stacking across slots

### Slot 1 — SCOUT (Fast / Opportunistic)
**Role:** quick micro mean-reversion.
- **Entry:** arms immediately when a window opens; lighter confirmation allowed (touch/near-touch + ATR non-expanding).
- **Exit:** take **any** profit quickly (+0.05% to +0.15%), stall exit, or short time exit (minutes).
- **Size:** small (10–20% of active capital).

### Slot 2 — FARMER (Calculated / Profitable)
**Role:** capture meaningful reversion.
- **Entry:** full VWAP ±1.5σ touch + clean reclaim/rejection; ATR flat or decreasing.
- **Exit:** return toward VWAP or fixed target (+0.3% to +0.7%) with time-based fallback.
- **Size:** medium (30–40% of active capital).

### Slot 3 — ANCHOR (Strict / Defensive)
**Role:** preserve capital + maintain high session win-rate (your original strict setup).
- **Entry:** strict confirmation (RQS ≥ 3/4, ATR clearly decreasing, no expansion candles).
- **Exit:** conservative targets + volatility/fee-velocity kill-switches.
- **Size:** largest allowed, capped by phase rules.

### Slot Priority & Coordination
1) Scout, 2) Farmer, 3) Anchor  
If regime fails → **all slots pause**. Refill a freed slot only if a valid window exists.

## Bot Execution Flow (High Level)

1) Run **paper mode** until qualification passes (24h runtime + ≥1 positive closed paper trade).  
2) Scan market regime; arm only if range conditions pass.  
3) Detect BUY/SELL windows using VWAP band touches + confirmation.  
4) Maintain up to **3 “slots”**:
   - Slots watch for windows (pending intent)
   - When a window opens, a slot becomes ARMED
   - When triggers hit, slot executes (OPEN)
5) Enforce kill-switches, stop rules, and cooldown.
6) After session ends, return to USDC and log summary.
7) Re-qualify via paper mode if required (errors/restarts/drawdown).

---

## Disclaimer

Probabilistic, not guaranteed. Prioritizes preservation and discipline over speed.
No averaging down, no chasing, no trend trading.
