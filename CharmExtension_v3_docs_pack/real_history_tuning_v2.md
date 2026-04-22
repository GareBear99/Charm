# Real-history catalogue + tuning

This package can now:
1) Fetch recent ETHUSDT candles using Binance's Market Data Only base endpoint (`https://data-api.binance.vision`).
2) Write a CSV price catalogue: `data/<SYMBOL>_<INTERVAL>_<DAYS>d.csv` with `t,close`.
3) Tune the 3-phase split plan over rolling 48h windows to maximize the number of windows that reach a target (e.g., $15).

## Run

### 1) Download candles + backtest + write CSV
```bash
BACKTEST_DAYS=14 BACKTEST_INTERVAL=1m npm run backtest:lp
```

### 2) Tune split + widths on real history
```bash
TUNE_INFILE=data/ETHUSDT_1m_14d.csv TUNE_TARGET_USD=15 TUNE_WINDOW_HOURS=48 npm run tune:3phase
```

It writes `backtests/tuned_3phase_15usd_48h.json`.

## Add-on: Paper Mode Qualification (Recommended)

Your backtests/tuning pick parameters; **paper mode validates execution** (slippage, fees, timing, RPC quirks).

Implement a `paper:qualify` run that:
- Simulates swap/LP actions using live quotes (but does not sign/broadcast).
- Logs every “would-trade” decision and the resulting estimated PnL.
- Enforces:
  - 24h runtime minimum
  - ≥1 net-positive closed paper trade before live mode unlocks

Suggested output:
- `paperlogs/<DATE>_qualify.json` (all decisions)
- `paperlogs/<DATE>_summary.json` (pass/fail + metrics)
