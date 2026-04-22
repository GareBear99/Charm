import "dotenv/config";
import fs from "fs";
import path from "path";

const INFILE = process.env.TUNE_INFILE ?? "data/ETHUSDT_1m_14d.csv";
const OUTDIR = process.env.TUNE_OUTDIR ?? "backtests";
const START_USD = Number(process.env.TUNE_START_USD ?? "12");
const TARGET_USD = Number(process.env.TUNE_TARGET_USD ?? "15");
const WINDOW_HOURS = Number(process.env.TUNE_WINDOW_HOURS ?? "48");
const STEP_HOURS = Number(process.env.TUNE_STEP_HOURS ?? "6");

const BASELINE_FEE_PER_DAY = Number(process.env.BACKTEST_BASELINE_FEE_PER_DAY ?? "0.0010");
const CONC_MULT = Number(process.env.BACKTEST_CONC_MULT ?? "20");
const GAS_TOTAL_USD = Number(process.env.BACKTEST_GAS_TOTAL_USD ?? "0.12");
const effRatePerDay = Math.min(0.02, BASELINE_FEE_PER_DAY * CONC_MULT);

function mkdirp(p){ fs.mkdirSync(p, { recursive: true }); }

function parseCSV(fp){
  const lines = fs.readFileSync(fp,"utf8").trim().split("\n");
  const rows = [];
  for (let i=1;i<lines.length;i++){
    const [t, close] = lines[i].split(",");
    if (!t || !close) continue;
    rows.push({ t: Number(t), close: Number(close) });
  }
  return rows;
}

const sqrt = Math.sqrt;

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

function lpEquityAtPrice(L, p, Pl, Pu, idleUsd){
  const sqrtPL=sqrt(Pl), sqrtPU=sqrt(Pu);
  const { amt0, amt1 } = amountsFromL(L, sqrt(p), sqrtPL, sqrtPU);
  return amt1 + amt0*p + idleUsd;
}

function simulatePhase(prices, startIdx, endIdx, equityUsd, width, activeFrac) {
  const p0 = prices[startIdx].close;
  const Pl = p0*(1-width), Pu = p0*(1+width);

  const activeUsd = equityUsd * activeFrac;
  const reserveUsd = equityUsd * (1-activeFrac);

  const usdc0 = (activeUsd/2) - (GAS_TOTAL_USD/2);
  const weth0 = (activeUsd/2) / p0;

  const sqrtP0=sqrt(p0), sqrtPL=sqrt(Pl), sqrtPU=sqrt(Pu);
  const L = LfromDeposit(weth0, usdc0, sqrtP0, sqrtPL, sqrtPU);

  const { amt0: init0, amt1: init1 } = amountsFromL(L, sqrtP0, sqrtPL, sqrtPU);
  const idleUsd = Math.max(0, (weth0 - init0)*p0) + Math.max(0, usdc0 - init1);

  let fees=0;
  for (let i=startIdx;i<endIdx;i++){
    const p=prices[i].close;
    const inR = (p>Pl && p<Pu);
    if (inR) {
      const eq = lpEquityAtPrice(L,p,Pl,Pu,idleUsd);
      fees += eq * effRatePerDay * (1/1440);
    }
  }
  const pEnd = prices[endIdx-1].close;
  let activeEnd = lpEquityAtPrice(L,pEnd,Pl,Pu,idleUsd) + fees - (GAS_TOTAL_USD/2);
  if (activeEnd < 0) activeEnd = 0;
  return reserveUsd + activeEnd;
}

function simulate3Phases(prices, startIdx, endIdx, params){
  const n = endIdx - startIdx;
  const one = Math.floor(n/3);

  let eq = START_USD;
  eq = simulatePhase(prices, startIdx, startIdx+one, eq, params.w1, params.f1);
  eq = simulatePhase(prices, startIdx+one, startIdx+2*one, eq, params.w2, params.f2);
  eq = simulatePhase(prices, startIdx+2*one, endIdx, eq, params.w3, params.f3);
  return eq;
}

function grid(){
  const widths = [0.006,0.0075,0.009,0.01,0.0125,0.015];
  const fracs  = [0.5,0.6,0.7,0.8,0.9];
  const combos=[];
  for (const w1 of widths) for (const w2 of widths) for (const w3 of widths){
    for (const f1 of fracs) for (const f2 of fracs) for (const f3 of fracs){
      combos.push({ w1,w2,w3,f1,f2,f3 });
    }
  }
  return combos;
}

async function main(){
  mkdirp(OUTDIR);
  if (!fs.existsSync(INFILE)) throw new Error(`Missing ${INFILE}. Run: npm run backtest:lp first (it writes CSV).`);
  const prices=parseCSV(INFILE);

  const winMins = WINDOW_HOURS*60;
  const stepMins = STEP_HOURS*60;

  const windows=[];
  for (let s=0; s+winMins <= prices.length; s+=stepMins){
    windows.push({ s, e: s+winMins });
  }
  if (!windows.length) throw new Error("Not enough history for the requested window.");
  console.log(`Tuning over ${windows.length} rolling windows (${WINDOW_HOURS}h, step ${STEP_HOURS}h).`);

  const combos = grid();
  const MAX_COMBOS = Number(process.env.TUNE_MAX_COMBOS ?? "20000");
  const sampled = combos.length > MAX_COMBOS ? combos.sort(()=>Math.random()-0.5).slice(0,MAX_COMBOS) : combos;

  let best=null;
  for (let idx=0; idx<sampled.length; idx++){
    const params = sampled[idx];
    let hits=0;
    const finals=[];
    for (const w of windows){
      const f=simulate3Phases(prices,w.s,w.e,params);
      finals.push(f);
      if (f >= TARGET_USD) hits++;
    }
    finals.sort((a,b)=>a-b);
    const avg = finals.reduce((a,b)=>a+b,0)/finals.length;
    const p10 = finals[Math.floor(finals.length*0.10)];
    const score = hits*1000 + avg + p10;

    if (!best || score>best.score){
      best={ params, hits, avg, p10, score };
    }
    if ((idx+1)%2000===0) console.log(`...tested ${idx+1}/${sampled.length}`);
  }

  const outPath = path.join(OUTDIR, `tuned_3phase_${TARGET_USD}usd_${WINDOW_HOURS}h.json`);
  fs.writeFileSync(outPath, JSON.stringify({ meta:{ INFILE, START_USD, TARGET_USD, WINDOW_HOURS, STEP_HOURS, effRatePerDay }, best }, null, 2));
  console.log("BEST:", best);
  console.log("Saved:", outPath);
}

main().catch(e=>{ console.error(e); process.exit(1); });
