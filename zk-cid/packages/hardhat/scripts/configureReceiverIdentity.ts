/**
 * Pin an already-deployed ComplianceGateReceiver to one CRE workflow identity.
 *
 * Usage (from packages/hardhat):
 *   tsx scripts/configureReceiverIdentity.ts
 *
 * Required env: DEPLOYER_PRIVATE_KEY (Receiver owner), EXPECTED_WORKFLOW_AUTHOR,
 * EXPECTED_WORKFLOW_ID. EXPECTED_WORKFLOW_NAME is optional.
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
    throw new Error("DEPLOYER_PRIVATE_KEY is required (must be the Receiver owner)");
  }

  const author = process.env.EXPECTED_WORKFLOW_AUTHOR?.trim() ?? "";
  const workflowId = process.env.EXPECTED_WORKFLOW_ID?.trim() ?? "";
  const workflowName = process.env.EXPECTED_WORKFLOW_NAME?.trim() ?? "";

  if (!ethers.isAddress(author)) {
    throw new Error("EXPECTED_WORKFLOW_AUTHOR must be a valid EVM address");
  }
  if (!ethers.isHexString(workflowId, 32)) {
    throw new Error("EXPECTED_WORKFLOW_ID must be a 32-byte hex string");
  }

  const deployment = JSON.parse(
    readFileSync(join(__dirname, "..", "deployments", "sepolia", "ComplianceGateReceiver.json"), "utf8"),
  );
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const receiver = new ethers.Contract(deployment.address, deployment.abi, wallet);

  const owner = await receiver.owner();
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`configured key ${wallet.address} is not the Receiver owner ${owner}`);
  }

  if ((await receiver.getExpectedAuthor()).toLowerCase() !== author.toLowerCase()) {
    const tx = await receiver.setExpectedAuthor(author);
    console.log("setExpectedAuthor tx:", tx.hash);
    await tx.wait();
  }
  if ((await receiver.getExpectedWorkflowId()).toLowerCase() !== workflowId.toLowerCase()) {
    const tx = await receiver.setExpectedWorkflowId(workflowId);
    console.log("setExpectedWorkflowId tx:", tx.hash);
    await tx.wait();
  }
  if (workflowName) {
    const tx = await receiver.setExpectedWorkflowName(workflowName);
    console.log("setExpectedWorkflowName tx:", tx.hash);
    await tx.wait();
  }

  const [pinnedAuthor, pinnedWorkflowId] = await Promise.all([
    receiver.getExpectedAuthor(),
    receiver.getExpectedWorkflowId(),
  ]);
  if (
    pinnedAuthor.toLowerCase() !== author.toLowerCase() ||
    pinnedWorkflowId.toLowerCase() !== workflowId.toLowerCase()
  ) {
    throw new Error("Receiver identity assertion failed");
  }
  console.log("Receiver pinned to workflow", workflowId, "author", author);
}

main().catch(error => {
  console.error("configure receiver identity failed:", error);
  process.exit(1);
});
