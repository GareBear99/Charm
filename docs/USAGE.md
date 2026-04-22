# Usage

This document captures the most common operator tasks. See `README.md` for
architectural orientation and project scope.

## Install
See `README.md` "Install" / "Setup" section.

## Run (paper-trading / dry-run)
Always start here. No real funds, no real orders. Verify the event stream,
logs, and signals before considering anything live.

## Run (live)
Live mode requires:
- API keys with the minimum permissions possible (no withdraw).
- IP whitelisting on the exchange where supported.
- A funded account sized to the strategy's design (not larger).
- Monitoring of logs and PnL in real time.

## Kill switch
Every bot in this fleet ships with a hard halt on: daily loss cap,
consecutive loss streak, drawdown floor, or manual SIGINT/SIGTERM. Know how to
trigger yours before running live.

## Logs
Logs are JSONL where possible. Parse with `jq`:
```bash
tail -f logs/*.jsonl | jq 'select(.type=="entry")'
```

## Updating
```bash
git pull origin main
# re-install deps if requirements changed
```
