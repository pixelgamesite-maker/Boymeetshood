// Reconciles the sBOYS receipt mirror with real Boys ownership.
//
// A Boy's EFFECTIVE owner (staker if staked, else wallet holder) only changes
// when the Boy MOVES on the real collection — a trade, a stake, or an unstake
// all emit a Boys Transfer. So we scan Boys Transfer logs since the last run,
// collect the token ids that moved, and sync just those. Idle runs send no
// transaction and cost no gas.
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync } from "node:fs";

const RPC = process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const RECEIPT = process.env.RECEIPT_ADDRESS;
const BOYS = process.env.BOYS_ADDRESS;
const PK = process.env.KEEPER_PRIVATE_KEY;
const STATE = process.env.STATE_FILE || ".keeper-last-block";
const FALLBACK = BigInt(process.env.FALLBACK_BLOCKS || "2000000"); // first run / cache miss
const MAX_RANGE = BigInt(process.env.MAX_LOG_RANGE || "9000000");  // per getLogs call
const BATCH = 200;

if (!RECEIPT || !BOYS || !PK) throw new Error("Missing RECEIPT_ADDRESS, BOYS_ADDRESS or KEEPER_PRIVATE_KEY");

const chain = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

const pub = createPublicClient({ chain, transport: http(RPC) });
const account = privateKeyToAccount(PK.startsWith("0x") ? PK : "0x" + PK);
const wallet = createWalletClient({ account, chain, transport: http(RPC) });

const transferAbi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);
const syncAbi = parseAbi(["function sync(uint256[] tokenIds)"]);

const latest = await pub.getBlockNumber();
let fromBlock;
try {
  fromBlock = BigInt(readFileSync(STATE, "utf8").trim()) + 1n;
} catch {
  fromBlock = latest > FALLBACK ? latest - FALLBACK : 0n;
}
if (fromBlock > latest) {
  console.log(`nothing new (last=${fromBlock - 1n}, latest=${latest})`);
  process.exit(0);
}

const ids = new Set();
for (let start = fromBlock; start <= latest; start += MAX_RANGE + 1n) {
  const end = start + MAX_RANGE < latest ? start + MAX_RANGE : latest;
  const logs = await pub.getLogs({ address: BOYS, event: transferAbi[0], fromBlock: start, toBlock: end });
  for (const l of logs) ids.add(l.args.tokenId);
  console.log(`scanned ${start}..${end}: ${logs.length} transfers`);
}

const list = [...ids];
console.log(`changed tokens: ${list.length}`);

for (let i = 0; i < list.length; i += BATCH) {
  const chunk = list.slice(i, i + BATCH);
  const hash = await wallet.writeContract({ address: RECEIPT, abi: syncAbi, functionName: "sync", args: [chunk] });
  await pub.waitForTransactionReceipt({ hash });
  console.log(`synced ${chunk.length} tokens (tx ${hash})`);
}

writeFileSync(STATE, latest.toString());
console.log(`done; advanced state to block ${latest}`);
