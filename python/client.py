"""Shared client: GET a route and pay with x402 when the API answers 402."""
import base64
import json
import os

import requests
from eth_account import Account
from x402 import x402ClientSync
from x402.http.clients import x402_requests
from x402.mechanisms.evm.exact import ExactEvmScheme
from x402.mechanisms.evm.signers import EthAccountSigner

API = os.environ.get("API_URL", "https://api.marketintelligenceapi.com")

# Base Sepolia by default: free faucet USDC (https://faucet.circle.com), 10 calls per wallet per day.
# Set NETWORK=eip155:8453 to pay with real USDC on Base.
NETWORK = os.environ.get("NETWORK", "eip155:84532")

# An API key (X-API-Key) replaces x402 payment; otherwise PRIVATE_KEY pays per call.
API_KEY = os.environ.get("API_KEY")
PRIVATE_KEY = os.environ.get("PRIVATE_KEY")
if not PRIVATE_KEY and not API_KEY:
    raise SystemExit("Set PRIVATE_KEY to the private key of the paying wallet (0x...), or API_KEY")

account = Account.from_key(PRIVATE_KEY) if PRIVATE_KEY else None

if account:
    # Only the configured network is registered, so the client picks that entry from the 402's accepts[].
    x402 = x402ClientSync()
    x402.register(NETWORK, ExactEvmScheme(signer=EthAccountSigner(account)))
    session = x402_requests(x402)
else:
    session = requests.Session()
    session.headers["X-API-Key"] = API_KEY


def get(path):
    """Returns (json body, settlement transaction or None)."""
    res = session.get(API + path, timeout=60)
    body = res.json()
    if res.status_code == 402 and body.get("reason") not in (None, "payment_required"):
        # The payment was sent but refused, e.g. invalid_exact_evm_insufficient_balance: fund the wallet.
        payer = (body.get("facilitatorResponse") or {}).get("payer") or (account and account.address)
        raise RuntimeError(f"payment refused for {path}: {body['reason']} (payer {payer} on {NETWORK})")
    if not res.ok:
        raise RuntimeError(f"{res.status_code} {path}: {json.dumps(body)[:500]}")
    settlement = res.headers.get("PAYMENT-RESPONSE")
    tx = json.loads(base64.b64decode(settlement)).get("transaction") if settlement else None
    return body, tx
