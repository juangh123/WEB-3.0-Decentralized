import { ethers } from "ethers";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// LOCAL USE ONLY: Anvil/Hardhat default account #0 private key. Never use on any live network.
const LOCAL_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const LOCAL_RPC_URL = "http://127.0.0.1:8545";

// Burner wallet authorized as the CRE workflow for the local demo.
// Override with: tsx scripts/authBurner.ts <address>  (or BURNER_ADDRESS env var).
const DEFAULT_BURNER_ADDRESS = "0x91bBb003ad5621244563858344D34327f08F021B";

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

const burnerAddress = process.argv[2] ?? process.env.BURNER_ADDRESS ?? DEFAULT_BURNER_ADDRESS;

const p = new ethers.JsonRpcProvider(LOCAL_RPC_URL);
const s = new ethers.Wallet(LOCAL_PRIVATE_KEY, p);
const a = JSON.parse(
  readFileSync(join(__dirname, "..", "artifacts/contracts/ComplianceGate.sol/ComplianceGate.json"), "utf-8"),
);
const g = new ethers.Contract(loadDeployedAddress("ComplianceGate"), a.abi, s);
const tx = await g.setWorkflow(burnerAddress);
await tx.wait();
console.log(`Burner ${burnerAddress} authorized as CRE workflow. Tx:`, tx.hash);
