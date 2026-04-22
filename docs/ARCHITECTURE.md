# Architecture

High-level architecture notes for this repository.
See `README.md` for the project's scope, inputs, outputs, and siblings in the
ARC ecosystem.

## Top-down view

1. **Data ingestion** — market data, funding rates, or pool reserves are
   sampled on a fixed cadence.
2. **Signal generation** — deterministic rules convert market state into a
   decision.
3. **Risk gate** — the decision must pass sizing, stop, streak, and drawdown
   checks.
4. **Execution** — orders/swaps are submitted through an adapter; dry-run
   short-circuits before the network call.
5. **State + logs** — every decision and outcome is written to a JSONL event
   log. When wired into [ARC-Core](https://github.com/GareBear99/ARC-Core)
   each decision becomes a receipted event on a tamper-evident chain.

## Extension points
- New venue / exchange adapter.
- New signal module (respecting the risk-gate contract).
- New post-trade sink (database, ARC-Core spine, notification channel).

## Non-goals
- High-frequency / colocation trading.
- Leverage beyond what the strategy's math justifies.
- Any form of martingale or averaging-down into a losing position.
