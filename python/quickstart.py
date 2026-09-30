"""Pay for one call and print the result.

    PRIVATE_KEY=0x... python quickstart.py
"""
import json

from client import NETWORK, account, get

print(f"Paying from {account.address} on {NETWORK}" if account else "Using API_KEY")

# $0.005: the crypto market regime (breadth, buy pressure, stablecoin flows).
data, tx = get("/api/v1/intelligence/regime?window=5m")
print(json.dumps(data, indent=2))
if tx:
    print("settled in transaction", tx)
