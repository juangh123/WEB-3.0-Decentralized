/**
 * Switch an already-deployed ComplianceGate from demo mode to strict ZK validation.
 *
 * Usage (from packages/hardhat):
 *   tsx scripts/setStrictMode.ts
 *
 * Required env: DEPLOYER_PRIVATE_KEY (the on-chain issuer).
 */
import "dotenv/config";
import { ethers } from "ethers";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const rpcUrl =
    process.env.SEPOLIA_RPC_URL ??
    (process.env.ALCHEMY_API_KEY
      ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      : "https://ethereum-sepolia-rpc.publicnode.com");

  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY is required (must be the gate issuer)");
  }

  const deployment = JSON.parse(
    readFileSync(join(__dirname, "..", "deployments", "sepolia", "ComplianceGate.json"), "utf8"),
  );
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const gate = new ethers.Contract(deployment.address, deployment.abi, wallet);

  const onChainIssuer = await gate.issuer();
  if (onChainIssuer.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`configured key ${wallet.address} is not the gate issuer ${onChainIssuer}`);
  }

  if (await gate.demoMode()) {
    const tx = await gate.setDemoMode(false);
    console.log("setDemoMode(false) tx:", tx.hash);
    await tx.wait();
  } else {
    console.log("ComplianceGate is already in strict mode");
  }

  if (await gate.demoMode()) {
    throw new Error("strict mode assertion failed: demoMode is still true");
  }
  console.log("ComplianceGate strict mode enabled at", deployment.address);
}

main().catch(error => {
  console.error("set strict mode failed:", error);
  process.exit(1);
});
