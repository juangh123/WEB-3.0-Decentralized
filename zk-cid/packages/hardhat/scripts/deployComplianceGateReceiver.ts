/**
 * Deploys the CRE write-path adapter (`ComplianceGateReceiver`) and authorises
 * it on the already-deployed `ComplianceGate`.
 *
 * Why an adapter instead of a new gate: the live gate is already source-verified
 * on Blockscout/Sourcify and referenced by the frontend, the docs and the
 * DoraHacks evidence. Redeploying it would invalidate all of that, while the
 * adapter gives the DON a real write path without touching the verified bytecode.
 *
 * Usage (from packages/hardhat):
 *   .\node_modules\.bin\tsx.cmd scripts\deployComplianceGateReceiver.ts
 *
 * Required env: DEPLOYER_PRIVATE_KEY (issuer key), optional SEPOLIA_RPC_URL.
 */
import "dotenv/config";
import { ethers } from "ethers";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/// Chainlink KeystoneForwarder on Ethereum Sepolia (from `cre workflow supported-chains`).
const SEPOLIA_KEYSTONE_FORWARDER = "0xF8344CFd5c43616a4366C34E3EEE75af79a74482";

async function main() {
  const rpcUrl =
    process.env.SEPOLIA_RPC_URL ??
    (process.env.ALCHEMY_API_KEY
      ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      : "https://ethereum-sepolia-rpc.publicnode.com");

  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY is required (must be the gate issuer)");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

  const gateDeployment = JSON.parse(
    readFileSync(join(__dirname, "..", "deployments", "sepolia", "ComplianceGate.json"), "utf8"),
  );
  const artifact = JSON.parse(
    readFileSync(
      join(
        __dirname,
        "..",
        "artifacts",
        "contracts",
        "cre",
        "ComplianceGateReceiver.sol",
        "ComplianceGateReceiver.json",
      ),
      "utf8",
    ),
  );

  console.log("deployer :", wallet.address);
  console.log("gate     :", gateDeployment.address);
  console.log("forwarder:", SEPOLIA_KEYSTONE_FORWARDER);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const receiver = await factory.deploy(SEPOLIA_KEYSTONE_FORWARDER, gateDeployment.address);
  const deployTx = receiver.deploymentTransaction();
  console.log("deploy tx:", deployTx?.hash);
  await receiver.waitForDeployment();
  const receiverAddress = await receiver.getAddress();
  console.log("ComplianceGateReceiver:", receiverAddress);

  const gate = new ethers.Contract(gateDeployment.address, gateDeployment.abi, wallet);
  const currentWorkflow: string = await gate.creWorkflow();
  console.log("current creWorkflow:", currentWorkflow);

  if (currentWorkflow.toLowerCase() !== receiverAddress.toLowerCase()) {
    const tx = await gate.setWorkflow(receiverAddress);
    console.log("setWorkflow tx:", tx.hash);
    await tx.wait();
  } else {
    console.log("creWorkflow already points at the adapter");
  }

  const record = {
    address: receiverAddress,
    deployer: wallet.address,
    deploymentTransaction: deployTx?.hash ?? null,
    forwarder: SEPOLIA_KEYSTONE_FORWARDER,
    complianceGate: gateDeployment.address,
    abi: artifact.abi,
  };
  const outPath = join(__dirname, "..", "deployments", "sepolia", "ComplianceGateReceiver.json");
  writeFileSync(outPath, JSON.stringify(record, null, 2) + "\n", "utf8");
  console.log("deployment record written:", outPath);
  console.log("creWorkflow now:", await gate.creWorkflow());
}

main().catch(error => {
  console.error("deploy ComplianceGateReceiver failed:", error);
  process.exit(1);
});
