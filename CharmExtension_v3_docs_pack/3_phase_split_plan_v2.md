# 3-Phase Plan (MetaMask ETH Strategy) — Split Rules

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

This is a **capital management wrapper** around the Uniswap v3 Base WETH/USDC LP strategy.
It does NOT guarantee profit. It forces discipline and reduces wipeout risk.

## Phase 1 — Build to $15 (Primary Growth)
**Starting equity:** $12  
**Target:** $15  
**Split rule:** 90% active / 10% reserve

- Active (90%): deploy as WETH/USDC concentrated liquidity
  - Default range: **±0.90%**
  - Hold window: up to **48h**
- Reserve (10%): keep as **USDC** (no LP)

**Exit triggers (any):**
- Equity ≥ $15
- Price leaves range for > 60 minutes
- Fee earnings stop growing for 3h

## Phase 2 — Protect & Push to $18
**Starting equity:** $15  
**Target:** $18  
**Split rule:** 70% active / 30% reserve

- Active 70%: deploy LP at **±1.25%** (more tolerant)
- Reserve 30%: keep USDC

**Exit triggers:**
- Equity ≥ $18
- 2 sustained range breaks (>60 min each)
- Daily volatility spikes (large 1h candles)

## Phase 3 — Lock Profit, Slow Grind to $20+
**Starting equity:** $18  
**Split rule:** 50% active / 50% reserve

- Active 50%: LP at **±1.50%** (safer)
- Reserve 50%: USDC

**Rules:**
- If equity drops below $17.25 → stop and hold USDC for 24h
- If equity ≥ $20 → exit all to USDC and stop for 24h

## Why splitting helps
- reduces “all-in” exposure to a sudden trend
- keeps dry powder to re-enter after volatility resets
