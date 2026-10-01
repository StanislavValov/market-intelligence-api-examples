# Market Intelligence API: x402 examples

Runnable examples for [Market Intelligence API](https://api.marketintelligenceapi.com), a pay-per-call API for AI agents:
on-chain order flow, one-call trading decisions, new-token risk checks, swap quotes, perps, macro calendar, SEC filings and more.

No account and no API key: the agent pays each call with [x402](https://x402.org) in USDC (Base, Polygon, Arbitrum, World Chain, Solana) or EURC.

## Try it free on Base Sepolia

Every paid route also accepts test USDC on **Base Sepolia** (`eip155:84532`), 10 calls per wallet per day.

1. Create a wallet (any EVM private key) and get test USDC from the [Circle faucet](https://faucet.circle.com) (choose Base Sepolia).
2. Run an example with `PRIVATE_KEY` set. The examples pay on Base Sepolia by default.
3. When you are ready, set `NETWORK=eip155:8453` and fund the wallet with real USDC on Base.

## TypeScript

```bash
cd typescript
npm install
PRIVATE_KEY=0x... npm run quickstart       # one paid call ($0.005): the crypto market regime
PRIVATE_KEY=0x... npm run new-token-bot    # the LOW_RISK new-token watcher below
```

Uses [`@x402/fetch`](https://www.npmjs.com/package/@x402/fetch) and [`@x402/evm`](https://www.npmjs.com/package/@x402/evm).

## Python

```bash
cd python
pip install -r requirements.txt
PRIVATE_KEY=0x... python quickstart.py
PRIVATE_KEY=0x... python new_token_bot.py
```

Uses the [`x402`](https://pypi.org/project/x402/) package with `requests`.

## The new-token bot

Every `EVERY_MINUTES` (15) the bot:

1. asks `/api/v1/intelligence/new-tokens` for tokens launched on Base in the last hour, filtered to `verdict=LOW_RISK` and at least `MIN_LIQUIDITY_USD` of liquidity ($0.02);
2. re-checks each new candidate with `/api/v1/intelligence/token-risk/{address}`: owner powers, holders, honeypot sell simulation, Uniswap v4 hooks ($0.01);
3. prices a `BUY_USDC` buy with `/api/v1/intelligence/quote`: best route across Uniswap v2/v3/v4 and Aerodrome, price impact, hooks on the route ($0.005).

It **never trades**: the swap is left as a `TODO` for your own wallet and router. Worst case it spends about $0.02 + 5 × $0.015 per round.

| Variable | Default | |
|---|---|---|
| `PRIVATE_KEY` | | paying wallet |
| `NETWORK` | `eip155:84532` | `eip155:8453` for Base mainnet |
| `API_KEY` | | use an API key instead of paying per call |
| `CHAIN` | `base` | `base` or `ethereum` |
| `MIN_LIQUIDITY_USD` | `20000` | |
| `BUY_USDC` | `25` | size of the priced buy |
| `LIMIT` | `5` | candidates per round |
| `EVERY_MINUTES` | `15` | |
| `ONCE` | | `1` runs a single round |

## MCP

Two MCP servers (streamable HTTP, no auth; paid tools use x402 or a prepaid-credit key):

| Server | URL | Tools |
|---|---|---|
| Core | `https://api.marketintelligenceapi.com/mcp/core` | 15 most used tools, for clients that load few tools |
| Full | `https://api.marketintelligenceapi.com/mcp` | every route as a tool (72) |

The core profile names its tools in dot notation: `decision.lite`, `decision.pre_trade`, `market.opportunities`,
`market.snapshot`, `market.explain_move`, `market.summary`, `token.risk`, `token.new_launches`, `token.swap_quote`,
`macro.calendar`, `news.symbol`, `stocks.fundamentals` and the free `decision.sample`, `signals.track_record` and `feedback.send`
(the `/mcp` names such as `get_decision_lite` work too). Prompts: `should_i_trade`, `check_token_before_buying`,
`market_briefing`, `explain_symbol_move`.
Each paid tool costs the same as its HTTP route.

Client configuration (Claude Desktop, Cursor and other clients that take a remote URL):

```json
{
  "mcpServers": {
    "market-intelligence": {
      "url": "https://api.marketintelligenceapi.com/mcp/core"
    }
  }
}
```

A client that cannot sign x402 payments can buy prepaid credit once (`POST /api/v1/credits/buy/5`) and add
`"headers": {"X-API-Key": "mi_..."}` next to `"url"`. Details: https://api.marketintelligenceapi.com/api/v1/credits

## More

- [llms.txt](https://api.marketintelligenceapi.com/llms.txt): the guide for agents
- [OpenAPI](https://api.marketintelligenceapi.com/openapi.json): every route, parameter and price
- MCP servers: `https://api.marketintelligenceapi.com/mcp/core` (15 core tools) and `https://api.marketintelligenceapi.com/mcp` (all tools)

This is not financial advice. New tokens are high risk even when rated LOW_RISK.
