import "dotenv/config";
import fs from "fs";
import path from "path";

// Public market data endpoint (no API key)
const BASE_URL = "https://data-api.binance.vision";
const SYMBOL = process.env.BACKTEST_SYMBOL ?? "ETHUSDT";
const INTERVAL = process.env.BACKTEST_INTERVAL ?? "1m"; // 1m, 5m, 15m...
const DAYS = Number(process.env.BACKTEST_DAYS ?? "7");   // recent history window to fetch
const OUTDIR = process.env.BACKTEST_OUTDIR ?? "backtests";

// LP model params (Uniswap v3-style, simplified)
const START_USD = Number(process.env.BACKTEST_START_USD ?? "12");
const WIDTHS = (process.env.BACKTEST_WIDTHS ?? "0.0125,0.009,0.0075").split(",").map(Number); // +/- percent widths
const FEE_TIER = Number(process.env.BACKTEST_FEE_TIER ?? "0.0005"); // 0.05% = 0.0005
const GAS_TOTAL_USD = Number(process.env.BACKTEST_GAS_TOTAL_USD ?? "0.12"); // add+remove approx
const HOLD_HOURS = Number(process.env.BACKTEST_HOLD_HOURS ?? "48");

// Baseline pool fee yield estimate per day (fee/TVL). We'll estimate from volume+liquidity if provided,
// else use a conservative default ~0.1%/day.
const BASELINE_FEE_PER_DAY = Number(process.env.BACKTEST_BASELINE_FEE_PER_DAY ?? "0.0010");
const CONC_MULT = Number(process.env.BACKTEST_CONC_MULT ?? "20"); // "concentration advantage" multiplier

function mkdirp(p){ fs.mkdirSync(p, { recursive: true }); }

async function fetchKlines({ symbol, interval, startTime, endTime, limit=1000 }) {
  const url = new URL("/api/v3/klines", BASE_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("startTime", String(startTime));
  url.searchParams.set("endTime", String(endTime));
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines error ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function loadRecentPrices() {
  // pull last DAYS of minute candles
  const now = Date.now();
  const start = now - DAYS*24*3600*1000;
  let cursor = start;
  const end = now;
  const prices = []; // {t, close}
  while (cursor < end) {
    const batch = await fetchKlines({ symbol: SYMBOL, interval: INTERVAL, startTime: cursor, endTime: end, limit: 1000 });
    if (!batch.length) break;
    for (const k of batch) {
      const t = Number(k[0]); // open time
      const close = Number(k[4]);
      prices.push({ t, close });
    }
    const lastT = Number(batch[batch.length-1][0]);
    // advance by 1 ms to avoid overlap
    cursor = lastT + 1;
    if (batch.length < 1000) break;
  }
  return prices;
}

// --- Uniswap v3 concentrated liquidity math (token0=WETH, token1=USDC), but we only need value evolution ---
function sqrt(x){ return Math.sqrt(x); }

function amountsFromL(L, sqrtP, sqrtPL, sqrtPU) {
  if (sqrtP <= sqrtPL) {
    const amt0 = L * (sqrtPU - sqrtPL) / (sqrtPL * sqrtPU);
    return { amt0, amt1: 0 };
  } else if (sqrtP >= sqrtPU) {
    const amt1 = L * (sqrtPU - sqrtPL);
    return { amt0: 0, amt1 };
  } else {
    const amt0 = L * (sqrtPU - sqrtP) / (sqrtP * sqrtPU);
    const amt1 = L * (sqrtP - sqrtPL);
    return { amt0, amt1 };
  }
}

function LfromDeposit(amt0, amt1, sqrtP, sqrtPL, sqrtPU) {
  if (sqrtP <= sqrtPL) {
    return amt0 * (sqrtPL * sqrtPU) / (sqrtPU - sqrtPL);
  } else if (sqrtP >= sqrtPU) {
    return amt1 / (sqrtPU - sqrtPL);
  } else {
    const L0 = amt0 > 0 ? amt0 * (sqrtP * sqrtPU) / (sqrtPU - sqrtP) : Infinity;
    const L1 = amt1 > 0 ? amt1 / (sqrtP - sqrtPL) : Infinity;
    return Math.min(L0, L1);
  }
}

function backtestLP(prices, width) {
  const p0 = prices[0].close;
  const Pl = p0*(1-width);
  const Pu = p0*(1+width);

  const usdc0 = (START_USD/2) - (GAS_TOTAL_USD/2);
  const weth0 = (START_USD/2) / p0;

  const sqrtP0 = sqrt(p0);
  const sqrtPL = sqrt(Pl);
  const sqrtPU = sqrt(Pu);

  const L = LfromDeposit(weth0, usdc0, sqrtP0, sqrtPL, sqrtPU);
  const { amt0: init0, amt1: init1 } = amountsFromL(L, sqrtP0, sqrtPL, sqrtPU);

  // Any leftover stays idle as USDC (rare, but keep safe)
  const idleUsd = Math.max(0, (weth0 - init0)*p0) + Math.max(0, usdc0 - init1);

  const holdMs = HOLD_HOURS * 3600 * 1000;
  const endT = prices[0].t + holdMs;

  // fee accrual: equity * effRatePerDay while in range
  const effRatePerDay = Math.min(0.02, BASELINE_FEE_PER_DAY * CONC_MULT);

  let feesUsd = 0;
  let inRangeMinutes = 0;
  let outRangeMinutes = 0;

  let last = prices[0];
  for (const pt of prices) {
    if (pt.t > endT) break;
    const p = pt.close;
    const inRange = (p > Pl && p < Pu);
    if (inRange) inRangeMinutes++;
    else outRangeMinutes++;

    // Approx dt as one interval step in minutes (works for 1m)
    const dtDays = 1 / 1440;
    if (inRange) {
      const { amt0, amt1 } = amountsFromL(L, sqrt(p), sqrtPL, sqrtPU);
      const equity = amt1 + amt0*p + idleUsd;
      feesUsd += equity * effRatePerDay * dtDays;
    }
    last = pt;
  }

  const pEnd = last.close;
  const { amt0: end0, amt1: end1 } = amountsFromL(L, sqrt(pEnd), sqrtPL, sqrtPU);
  let equityFinal = end1 + end0*pEnd + idleUsd + feesUsd - (GAS_TOTAL_USD/2);

  return {
    width,
    p0,
    pEnd,
    Pl,
    Pu,
    feesUsd,
    equityFinal,
    inRangeMinutes,
    outRangeMinutes,
    effRatePerDay
  };
}

async function main() {
  mkdirp(OUTDIR);
  console.log(`Fetching ${DAYS}d of ${SYMBOL} ${INTERVAL} candles from Binance data-api...`);
  const prices = await loadRecentPrices();
  if (prices.length < 60) throw new Error("Not enough candles returned. Try increasing BACKTEST_DAYS.");
  console.log(`Loaded ${prices.length} candles. Running LP backtest for hold=${HOLD_HOURS}h...`);

  // Also catalogue closes to CSV for tuning/analysis
  const csvPath = path.join("data", `${SYMBOL}_${INTERVAL}_${DAYS}d.csv`);
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(csvPath, "t,close\n" + prices.map(p => `${p.t},${p.close}`).join("\n") + "\n");
  console.log(`Wrote price catalogue CSV: ${csvPath}`);


  const results = WIDTHS.map(w => backtestLP(prices, w));
  results.sort((a,b)=>b.equityFinal-a.equityFinal);

  const outPath = path.join(OUTDIR, `lp_backtest_${SYMBOL}_${INTERVAL}_${DAYS}d.json`);
  fs.writeFileSync(outPath, JSON.stringify({ meta: { SYMBOL, INTERVAL, DAYS, START_USD, HOLD_HOURS }, results }, null, 2));

  console.log("Top results:");
  for (const r of results) {
    const pct = ((r.equityFinal/START_USD)-1)*100;
    console.log(`  width=±${(r.width*100).toFixed(2)}% | final=$${r.equityFinal.toFixed(2)} (${pct.toFixed(1)}%) | fees=$${r.feesUsd.toFixed(2)} | inRange=${r.inRangeMinutes}m`);
  }
  console.log(`Saved: ${outPath}`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
