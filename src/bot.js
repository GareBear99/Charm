import "dotenv/config";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

const RPC_URL = process.env.RPC_URL_BASE ?? "https://mainnet.base.org";
const PRIVATE_KEY = process.env.BOT_PRIVATE_KEY;

const MAX_USD_CAP = Number(process.env.MAX_USD_CAP ?? "12");
const SLIPPAGE_BPS = BigInt(process.env.SLIPPAGE_BPS ?? "60"); // 0.60%
const SAMPLE_SECONDS = Number(process.env.SAMPLE_SECONDS ?? "5");
const WINDOW_MINUTES = Number(process.env.WINDOW_MINUTES ?? "30");
const K_SIGMA = Number(process.env.K_SIGMA ?? "1.5");
const COOLDOWN_SECONDS = Number(process.env.COOLDOWN_SECONDS ?? "300");

const MAX_TRADES = Number(process.env.MAX_TRADES ?? "3");
const STOP_AFTER_LOSSES = Number(process.env.STOP_AFTER_LOSSES ?? "2");
const USDC_BUY_FRACTION = Number(process.env.USDC_BUY_FRACTION ?? "0.98");
const WETH_SELL_FRACTION = Number(process.env.WETH_SELL_FRACTION ?? "0.98");

const DRY_RUN = process.env.DRY_RUN === "1";

// Base addresses
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH = "0x4200000000000000000000000000000000000006";

// Uniswap v3 periphery on Base (Uniswap docs)
const QUOTER_V2      = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";
const SWAP_ROUTER_02 = "0x2626664c2603336E57B271c5C0b26F421741e481";

// Uniswap v3 WETH/USDC pool on Base (0.05%)
const POOL = "0xd0b53D9277642d899DF5C87A3966A349A798F224";
const FEE_TIER = 500;

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 value) returns (bool)",
];

const POOL_ABI = [
  "function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16,uint16,uint16,uint8,bool)",
];

const ROUTER_ABI = [
  "function exactInputSingle(tuple(address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)"
];

const QUOTER_ABI = [
  "function quoteExactInputSingle(tuple(address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)"
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function mean(arr) { return arr.reduce((a,b)=>a+b,0) / arr.length; }
function stdev(arr) { const m=mean(arr); return Math.sqrt(arr.reduce((a,b)=>a+(b-m)*(b-m),0)/arr.length); }
function bnMulDiv(a,b,d){ return (a*b)/d; }

const STATE_PATH = path.join(process.cwd(), "state.json");
function loadState(){ try{ return JSON.parse(fs.readFileSync(STATE_PATH,"utf8")); } catch { return { startedAt: Date.now(), lastTradeTs: 0, trades: 0, losses: 0, lastEquityUsd: null }; } }
function saveState(st){ fs.writeFileSync(STATE_PATH, JSON.stringify(st,null,2)); }

function priceUsdcPerWethFromSqrtX96(sqrtPriceX96, decWeth=18, decUsdc=6) {
  const Q96 = 2n ** 96n;
  const sp = BigInt(sqrtPriceX96.toString());
  const num = sp * sp;
  const den = Q96 * Q96;
  const SCALE = 10n ** 18n;
  const ratioScaled = (num * SCALE) / den; // (USDC_raw / WETH_raw) * 1e18
  const exp = BigInt(decWeth - decUsdc);    // 12
  const humanScaled = ratioScaled * (10n ** exp);
  return Number(humanScaled) / 1e18;
}

async function main() {
  if (!PRIVATE_KEY) throw new Error("Missing BOT_PRIVATE_KEY in .env");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const usdc = new ethers.Contract(USDC, ERC20_ABI, wallet);
  const weth = new ethers.Contract(WETH, ERC20_ABI, wallet);
  const pool = new ethers.Contract(POOL, POOL_ABI, provider);
  const router = new ethers.Contract(SWAP_ROUTER_02, ROUTER_ABI, wallet);
  const quoter = new ethers.Contract(QUOTER_V2, QUOTER_ABI, wallet);

  const usdcDecimals = await usdc.decimals();
  const wethDecimals = await weth.decimals();

  console.log("════════════════════════════════════════════════════");
  console.log("🪄 Charm Extension — Base Uniswap v3 Mean Reversion Bot");
  console.log("════════════════════════════════════════════════════");
  console.log("Wallet:", wallet.address);
  console.log("DRY_RUN:", DRY_RUN);
  console.log("Cap:", `$${MAX_USD_CAP}`);
  console.log("Pool:", POOL, "Fee:", FEE_TIER);
  console.log("────────────────────────────────────────────────────");

  if (!DRY_RUN) {
    await (await usdc.approve(SWAP_ROUTER_02, ethers.MaxUint256)).wait();
    await (await weth.approve(SWAP_ROUTER_02, ethers.MaxUint256)).wait();
  } else {
    console.log("DRY_RUN: skipping approvals");
  }

  const windowSize = Math.floor((WINDOW_MINUTES * 60) / SAMPLE_SECONDS);
  const prices = [];
  const st = loadState();

  while (true) {
    const slot0 = await pool.slot0();
    const ethPrice = priceUsdcPerWethFromSqrtX96(slot0.sqrtPriceX96, wethDecimals, usdcDecimals);
    prices.push(ethPrice);
    if (prices.length > windowSize) prices.shift();

    const usdcBal = await usdc.balanceOf(wallet.address);
    const wethBal = await weth.balanceOf(wallet.address);

    const usdcFloat = Number(ethers.formatUnits(usdcBal, usdcDecimals));
    const wethFloat = Number(ethers.formatUnits(wethBal, wethDecimals));
    const equityUsd = usdcFloat + wethFloat * ethPrice;

    if (equityUsd > MAX_USD_CAP * 1.05) {
      console.log(`\n🛑 SAFETY HALT: equity $${equityUsd.toFixed(2)} exceeds cap $${MAX_USD_CAP}`);
      return;
    }

    if (prices.length < windowSize) {
      process.stdout.write(`Building window ${prices.length}/${windowSize} | ETH $${ethPrice.toFixed(2)} | Equity $${equityUsd.toFixed(2)}\r`);
      await sleep(SAMPLE_SECONDS * 1000);
      continue;
    }

    const mu = mean(prices);
    const sigma = stdev(prices);
    const lower = mu - K_SIGMA * sigma;
    const upper = mu + K_SIGMA * sigma;

    const now = Math.floor(Date.now() / 1000);
    const cooldownOk = (now - st.lastTradeTs) >= COOLDOWN_SECONDS;

    if (st.trades >= MAX_TRADES) { console.log(`\n🛑 Max trades reached (${MAX_TRADES}). Stopping.`); return; }
    if (st.losses >= STOP_AFTER_LOSSES) { console.log(`\n🛑 Loss limit reached (${STOP_AFTER_LOSSES}). Stopping.`); return; }

    const inEth = wethFloat > 0.00005 && usdcFloat < (MAX_USD_CAP * 0.6);

    const buySignal = !inEth && cooldownOk && ethPrice <= lower * 1.001;
    const sellSignal = inEth && cooldownOk && ethPrice >= upper * 0.999;

    console.log(`\nETH $${ethPrice.toFixed(2)} | μ $${mu.toFixed(2)} σ ${sigma.toFixed(3)} | L $${lower.toFixed(2)} U $${upper.toFixed(2)} | USDC ${usdcFloat.toFixed(2)} WETH ${wethFloat.toFixed(6)} | eq $${equityUsd.toFixed(2)} | trades ${st.trades} losses ${st.losses}`);

    if (buySignal && usdcFloat > 1.0) {
      const amountIn = (BigInt(usdcBal.toString()) * BigInt(Math.floor(USDC_BUY_FRACTION * 1000))) / 1000n;
      const quote = await quoter.quoteExactInputSingle({ tokenIn: USDC, tokenOut: WETH, amountIn, fee: FEE_TIER, sqrtPriceLimitX96: 0 });
      const outQuoted = quote[0];
      const minOut = bnMulDiv(outQuoted, (10000n - SLIPPAGE_BPS), 10000n);

      console.log(`BUY: in=${ethers.formatUnits(amountIn, usdcDecimals)} USDC | quoted=${ethers.formatUnits(outQuoted, wethDecimals)} WETH | min=${ethers.formatUnits(minOut, wethDecimals)} WETH`);

      if (!DRY_RUN) {
        const tx = await router.exactInputSingle({ tokenIn: USDC, tokenOut: WETH, fee: FEE_TIER, recipient: wallet.address, deadline: BigInt(now + 180), amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n });
        console.log("TX:", tx.hash);
        await tx.wait();
        st.lastTradeTs = now;
        st.trades += 1;
        st.lastEquityUsd = equityUsd;
        saveState(st);
        console.log("✅ BUY complete.");
      } else {
        console.log("DRY_RUN: would BUY now.");
      }
    }

    if (sellSignal && wethFloat > 0.00005) {
      const amountIn = (BigInt(wethBal.toString()) * BigInt(Math.floor(WETH_SELL_FRACTION * 1000))) / 1000n;
      const quote = await quoter.quoteExactInputSingle({ tokenIn: WETH, tokenOut: USDC, amountIn, fee: FEE_TIER, sqrtPriceLimitX96: 0 });
      const outQuoted = quote[0];
      const minOut = bnMulDiv(outQuoted, (10000n - SLIPPAGE_BPS), 10000n);

      console.log(`SELL: in=${ethers.formatUnits(amountIn, wethDecimals)} WETH | quoted=${ethers.formatUnits(outQuoted, usdcDecimals)} USDC | min=${ethers.formatUnits(minOut, usdcDecimals)} USDC`);

      if (!DRY_RUN) {
        const tx = await router.exactInputSingle({ tokenIn: WETH, tokenOut: USDC, fee: FEE_TIER, recipient: wallet.address, deadline: BigInt(now + 180), amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n });
        console.log("TX:", tx.hash);
        await tx.wait();
        st.lastTradeTs = now;
        st.trades += 1;
        st.lastEquityUsd = equityUsd;
        saveState(st);
        console.log("✅ SELL complete.");
      } else {
        console.log("DRY_RUN: would SELL now.");
      }
    }

    saveState(st);
    await sleep(SAMPLE_SECONDS * 1000);
  }
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
