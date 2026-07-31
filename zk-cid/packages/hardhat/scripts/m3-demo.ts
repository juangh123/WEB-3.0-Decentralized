// M3 CRE Workflow Demo: Simulate sanctions check + on-chain revocation
import { ethers } from "ethers";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// LOCAL USE ONLY: Anvil/Hardhat default account #0 private key. Never use on any live network.
const LOCAL_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const LOCAL_RPC_URL = "http://127.0.0.1:8545";

// Resolve deployed contract addresses from deployments/localhost/*.json (written by the deploy scripts).
function loadDeployedAddress(name: string): string {
  const file = join(__dirname, "..", "deployments", "localhost", `${name}.json`);
  try {
    return JSON.parse(readFileSync(file, "utf-8")).address;
  } catch {
    throw new Error(
      `No deployment found for ${name} at ${file}. Deploy the contracts first (scripts/deployDirect.ts).`,
    );
  }
}

async function main() {
  const provider = new ethers.JsonRpcProvider(LOCAL_RPC_URL);
  const signer = new ethers.Wallet(LOCAL_PRIVATE_KEY, provider);
  const artifact = JSON.parse(
    readFileSync(__dirname + "/../artifacts/contracts/ComplianceGate.sol/ComplianceGate.json", "utf-8"),
  );
  const gateAddress = loadDeployedAddress("ComplianceGate");
  const gate = new ethers.Contract(gateAddress, artifact.abi, signer);
  console.log("  Gate address:", gateAddress);

  // Step 1: Fetch sanctions list from Mock API
  console.log("=".repeat(60));
  console.log("  CRE WORKFLOW: COMPLIANCE LIFECYCLE — SANCTION REVOCATION");
  console.log("=".repeat(60));

  console.log("\n[1/4] Fetching sanctions list from Mock API...");
  const response = await fetch("http://localhost:3001/api/sanctions-list");
  const data = await response.json();
  console.log("  API Response:", JSON.stringify(data, null, 2));

  // Step 2: Get current compliance group members
  console.log("\n[2/4] Reading compliance group members from chain...");
  const members = await gate.getMembers();
  console.log(
    "  On-chain members:",
    members.map(m => m.toString()),
  );

  if (members.length === 0) {
    console.log("\n  No members in group — nothing to revoke. Issue a credential first!");
    return;
  }

  // Step 3: Cross-match sanctioned list against members
  console.log("\n[3/4] Cross-matching sanctioned list against group members...");
  const sanctionedSet = new Set(data.sanctioned.map((s: string) => BigInt(s)));
  const toRevoke = [...new Set(members.filter((m: bigint) => sanctionedSet.has(m)).map((m: bigint) => m.toString()))];

  if (toRevoke.length === 0) {
    console.log("  No sanctioned members found. All credentials remain valid.");
    return;
  }

  console.log(`  ⚠️  Found ${toRevoke.length} unique sanctioned member(s):`, toRevoke);

  // Step 4: Execute on-chain revocation
  console.log("\n[4/4] Submitting revocation transaction...");
  for (const commitment of toRevoke) {
    const isRevoked = await gate.hasBeenRevoked(commitment);
    if (isRevoked) {
      console.log(`  ✓ Credential ${commitment} is ALREADY REVOKED (skipped)`);
      continue;
    }
    try {
      const tx = await gate.revokeCredential(commitment, []);
      const receipt = await tx.wait();
      console.log(`  ✓ Credential ${commitment} REVOKED`);
      console.log(`     Tx: ${receipt.hash}`);
      console.log(`     Block: ${receipt.blockNumber}`);
    } catch (e: any) {
      console.log(`  ✖ Failed to revoke ${commitment}: ${e.shortMessage || e.message}`);
    }
  }

  // Verify
  const remaining = await gate.getMembers();
  console.log("\n" + "=".repeat(60));
  console.log("  REVOCATION COMPLETE");
  console.log("=".repeat(60));
  console.log(
    "  Remaining members:",
    remaining.map(m => m.toString()),
  );
  console.log("  Members revoked:", toRevoke.length);
}

main().catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
