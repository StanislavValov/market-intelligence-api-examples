// Watches new Base tokens and keeps only the ones the API rates LOW_RISK, then prices a small buy.
// It never trades: plug your own execution in where marked.
//   PRIVATE_KEY=0x... npm run new-token-bot
import { get } from "./client.js";

const CHAIN = process.env.CHAIN ?? "base";
const MIN_LIQUIDITY_USD = Number(process.env.MIN_LIQUIDITY_USD ?? 20000);
const BUY_USDC = process.env.BUY_USDC ?? "25";
const EVERY_MINUTES = Number(process.env.EVERY_MINUTES ?? 15);
const LIMIT = Number(process.env.LIMIT ?? 5);
const ONCE = process.env.ONCE === "1";
const USDC: Record<string, string> = {
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  ethereum: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
};

const seen = new Set<string>();

async function tick() {
  // $0.02: pools opened in the last hour, already risk-checked (liquidity, sell simulation, v4 hooks).
  const { data } = await get(
    `/api/v1/intelligence/new-tokens?chain=${CHAIN}&minutes=60&limit=${LIMIT}&minLiquidityUsd=${MIN_LIQUIDITY_USD}&verdict=LOW_RISK`,
  );
  const tokens: any[] = data.tokens ?? [];
  console.log(new Date().toISOString(), `${tokens.length} LOW_RISK candidate(s)`);

  for (const t of tokens) {
    const address: string = t.token;
    if (!address || seen.has(address.toLowerCase())) continue;
    seen.add(address.toLowerCase());

    // $0.01: a second, deeper check right before buying (holders, owner powers, honeypot simulation).
    const { data: risk } = await get(`/api/v1/intelligence/token-risk/${address}?chain=${CHAIN}`);
    if (risk.verdict !== "LOW_RISK") {
      console.log(`  skip ${address}: token-risk says ${risk.verdict}`);
      continue;
    }

    // $0.005: what BUY_USDC would get you right now, with price impact.
    const { data: quote } = await get(
      `/api/v1/intelligence/quote?chain=${CHAIN}&sell=${USDC[CHAIN]}&buy=${address}&amount=${BUY_USDC}&slippageBps=100`,
    );
    const best = quote.best;
    console.log(
      `  BUY candidate ${t.tokenInfo?.symbol ?? "?"} ${address}: ${BUY_USDC} USDC -> ${quote.buy.amount} via ${best.dex}, ` +
        `impact ${best.priceImpactPercent}%, liquidity ${t.liquidityUsd}`,
    );
    // The route can pass through other pools: a Uniswap v4 hook on the way can tax or block the trade.
    // One pool: route is that pool; two pools: route.hop1 and route.hop2, each with a detail.
    const pools = best.route?.hop1 ? [best.route.hop1.detail, best.route.hop2?.detail] : [best.route];
    for (const pool of pools) for (const power of pool?.hookPowers ?? []) console.log(`    route hook: ${power}`);
    for (const w of quote.warnings ?? []) if (!w.includes("token-risk")) console.log(`    warning: ${w}`);
    // TODO: execute the swap with your own wallet/router here (the API only analyses, it never trades).
  }
}

do {
  try {
    await tick();
  } catch (e) {
    console.error(String(e));
  }
  if (!ONCE) await new Promise((r) => setTimeout(r, EVERY_MINUTES * 60_000));
} while (!ONCE);
