/**
 * Rotates the trusted forwarder on the deployed `ComplianceGateReceiver`.
 *
 * Production config trusts the Chainlink Keystone forwarder. For a testnet
 * rehearsal you can temporarily point it at the Sepolia MockKeystoneForwarder,
 * which lets `cre workflow simulate --broadcast` deliver a real transaction
 * without CRE-network deployment access. Switch it back afterwards.
 *
 * Usage (from packages/hardhat):
 *   .\node_modules\.bin\tsx.cmd scripts\switchReceiverForwarder.ts production
 *   .\node_modules\.bin\tsx.cmd scripts\switchReceiverForwarder.ts mock
 *   .\node_modules\.bin\tsx.cmd scripts\switchReceiverForwarder.ts 0x<address>
 */
import "dotenv/config";
import { ethers } from "ethers";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const FORWARDERS: Record<string, string> = {
  production: "0xF8344CFd5c43616a4366C34E3EEE75af79a74482",
  mock: "0x15fC6ae953E024d975e77382eEeC56A9101f9F88",
};

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    throw new Error("pass 'production', 'mock' or an explicit 0x address");
  }
  const target = FORWARDERS[arg] ?? arg;
  if (!ethers.isAddress(target)) {
    throw new Error(`not an address: ${target}`);
  }

  const rpcUrl =
    process.env.SEPOLIA_RPC_URL ??
    (process.env.ALCHEMY_API_KEY
      ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      : "https://ethereum-sepolia-rpc.publicnode.com");

  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY is required (adapter owner)");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const record = JSON.parse(
    readFileSync(join(__dirname, "..", "deployments", "sepolia", "ComplianceGateReceiver.json"), "utf8"),
  );
  const receiver = new ethers.Contract(record.address, record.abi, wallet);

  console.log("receiver :", record.address);
  console.log("owner    :", await receiver.owner());
  console.log("current  :", await receiver.getForwarderAddress());

  const tx = await receiver.setForwarderAddress(target);
  console.log("tx       :", tx.hash);
  await tx.wait();
  console.log("new      :", await receiver.getForwarderAddress());
}

main().catch(error => {
  console.error("switchReceiverForwarder failed:", error);
  process.exit(1);
});
