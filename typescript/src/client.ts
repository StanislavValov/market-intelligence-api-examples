import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

export const API = process.env.API_URL ?? "https://api.marketintelligenceapi.com";

// Base Sepolia by default: free faucet USDC (https://faucet.circle.com), 10 calls per wallet per day.
// Set NETWORK=eip155:8453 to pay with real USDC on Base.
export const NETWORK = (process.env.NETWORK ?? "eip155:84532") as `${string}:${string}`;

// An API key (X-API-Key) replaces x402 payment; otherwise PRIVATE_KEY pays per call.
const API_KEY = process.env.API_KEY;
const key = process.env.PRIVATE_KEY;
if (!key && !API_KEY) throw new Error("Set PRIVATE_KEY to the private key of the paying wallet (0x...), or API_KEY");
export const account = key ? privateKeyToAccount(key as `0x${string}`) : undefined;

// Only the configured network is registered, so the client picks that entry from the 402's accepts[].
const paidFetch = account
  ? wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network: NETWORK, client: new ExactEvmScheme(account) }] })
  : fetch;

/** GET a route, paying with x402 when the API answers 402. Returns the JSON body and the settlement, if any. */
export async function get<T = any>(path: string): Promise<{ data: T; tx?: string }> {
  const res = await paidFetch(API + path, API_KEY ? { headers: { "X-API-Key": API_KEY } } : undefined);
  const body = await res.json();
  if (res.status === 402 && body.reason && body.reason !== "payment_required") {
    // The payment was sent but refused, e.g. invalid_exact_evm_insufficient_balance: fund the wallet.
    throw new Error(`payment refused for ${path}: ${body.reason} (payer ${body.facilitatorResponse?.payer ?? account?.address} on ${NETWORK})`);
  }
  if (!res.ok) throw new Error(`${res.status} ${path}: ${JSON.stringify(body).slice(0, 500)}`);
  const settlement = res.headers.get("PAYMENT-RESPONSE");
  return { data: body as T, tx: settlement ? decodePaymentResponseHeader(settlement).transaction : undefined };
}
