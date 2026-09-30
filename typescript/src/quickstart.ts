// Pay for one call and print the result.
//   PRIVATE_KEY=0x... npm run quickstart
import { account, get, NETWORK } from "./client.js";

console.log(account ? `Paying from ${account.address} on ${NETWORK}` : "Using API_KEY");

// $0.005: the crypto market regime (breadth, buy pressure, stablecoin flows).
const { data, tx } = await get("/api/v1/intelligence/regime?window=5m");
console.log(JSON.stringify(data, null, 2));
if (tx) console.log("settled in transaction", tx);
