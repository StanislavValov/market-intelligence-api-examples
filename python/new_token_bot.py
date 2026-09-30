"""Watches new Base tokens and keeps only the ones the API rates LOW_RISK, then prices a small buy.
It never trades: plug your own execution in where marked.

    PRIVATE_KEY=0x... python new_token_bot.py
"""
import os
import time
from datetime import datetime, timezone

from client import get

CHAIN = os.environ.get("CHAIN", "base")
MIN_LIQUIDITY_USD = float(os.environ.get("MIN_LIQUIDITY_USD", 20000))
BUY_USDC = os.environ.get("BUY_USDC", "25")
EVERY_MINUTES = float(os.environ.get("EVERY_MINUTES", 15))
LIMIT = int(os.environ.get("LIMIT", 5))
ONCE = os.environ.get("ONCE") == "1"
USDC = {
    "base": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "ethereum": "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
}

seen = set()


def tick():
    # $0.02: pools opened in the last hour, already risk-checked (liquidity, sell simulation, v4 hooks).
    data, _ = get(f"/api/v1/intelligence/new-tokens?chain={CHAIN}&minutes=60&limit={LIMIT}"
                  f"&minLiquidityUsd={MIN_LIQUIDITY_USD:g}&verdict=LOW_RISK")
    tokens = data.get("tokens", [])
    print(datetime.now(timezone.utc).isoformat(), f"{len(tokens)} LOW_RISK candidate(s)")

    for t in tokens:
        address = t.get("token")
        if not address or address.lower() in seen:
            continue
        seen.add(address.lower())

        # $0.01: a second, deeper check right before buying (holders, owner powers, honeypot simulation).
        risk, _ = get(f"/api/v1/intelligence/token-risk/{address}?chain={CHAIN}")
        if risk.get("verdict") != "LOW_RISK":
            print(f"  skip {address}: token-risk says {risk.get('verdict')}")
            continue

        # $0.005: what BUY_USDC would get you right now, with price impact.
        quote, _ = get(f"/api/v1/intelligence/quote?chain={CHAIN}&sell={USDC[CHAIN]}&buy={address}"
                       f"&amount={BUY_USDC}&slippageBps=100")
        best = quote["best"]
        symbol = (t.get("tokenInfo") or {}).get("symbol", "?")
        print(f"  BUY candidate {symbol} {address}: {BUY_USDC} USDC -> {quote['buy']['amount']} via {best['dex']}, "
              f"impact {best['priceImpactPercent']}%, liquidity ${t.get('liquidityUsd')}")
        # The route can pass through other pools: a Uniswap v4 hook on the way can tax or block the trade.
        # One pool: route is that pool; two pools: route.hop1 and route.hop2, each with a detail.
        route = best.get("route") or {}
        pools = [(route.get(h) or {}).get("detail") or {} for h in ("hop1", "hop2")] if "hop1" in route else [route]
        for pool in pools:
            for power in pool.get("hookPowers", []):
                print(f"    route hook: {power}")
        for w in quote.get("warnings", []):
            if "token-risk" not in w:
                print(f"    warning: {w}")
        # TODO: execute the swap with your own wallet/router here (the API only analyses, it never trades).


while True:
    try:
        tick()
    except Exception as e:  # keep the loop alive on network or payment errors
        print(e)
    if ONCE:
        break
    time.sleep(EVERY_MINUTES * 60)
