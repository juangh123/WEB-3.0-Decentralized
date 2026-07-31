import { ethers } from "ethers";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// LOCAL USE ONLY: Anvil/Hardhat default account #0 private key. Never use on any live network.
const LOCAL_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const LOCAL_RPC_URL = "http://127.0.0.1:8545";

function loadArtifact(name: string) {
  const path = join(__dirname, "..", "artifacts", "contracts", `${name}.sol`, `${name}.json`);
  return JSON.parse(readFileSync(path, "utf-8"));
}

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
  const deployer = new ethers.Wallet(LOCAL_PRIVATE_KEY, provider);

  const gateAddress = loadDeployedAddress("ComplianceGate");

  const gateArtifact = loadArtifact("ComplianceGate");
  const gate = new ethers.Contract(gateAddress, gateArtifact.abi, deployer);

  // Identity commitment from the user page
  const commitment = "5971644768800692991947631472118425334028045883019724522721770548264953610582";

  console.log("Issuing credential for commitment:", commitment);
  console.log("Issuer (deployer):", deployer.address);
  console.log("Gate address:", gateAddress);

  const tx = await gate.issueCredential(commitment);
  await tx.wait();

  console.log("Credential issued successfully! Tx:", tx.hash);

  // Verify members
  const members = await gate.getMembers();
  console.log(
    "Members after issuance:",
    members.map((m: bigint) => m.toString()),
  );
}

main().catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
