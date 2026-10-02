import "dotenv/config";
import { ethers } from "ethers";
import { Group } from "@semaphore-protocol/group";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEMO_COMMITMENT = process.env.DEMO_COMMITMENT ?? "123456789012345678901234567890123456789";

const gateDeployment = JSON.parse(
  readFileSync(join(__dirname, "..", "deployments", "sepolia", "ComplianceGate.json"), "utf8"),
);
const GATE_ADDRESS = gateDeployment.address;
const gateArtifact = { abi: gateDeployment.abi };

async function main() {
  const action = process.argv[2] ?? "status";
  const rpcUrl =
    process.env.SEPOLIA_RPC_URL ??
    (process.env.ALCHEMY_API_KEY
      ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      : "https://ethereum-sepolia-rpc.publicnode.com");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const gate: any = new ethers.Contract(GATE_ADDRESS, gateArtifact.abi, provider);

  if (action === "status") {
    const members = await gate.getMembers();
    const commitment = BigInt(DEMO_COMMITMENT);
    console.log("ComplianceGate:", GATE_ADDRESS);
    console.log("groupId:", (await gate.groupId()).toString());
    console.log("creWorkflow:", await gate.creWorkflow());
    console.log(
      "members:",
      members.map((value: bigint) => value.toString()),
    );
    console.log("isMember(demo):", await gate.isMember(commitment));
    console.log("hasBeenRevoked(demo):", await gate.hasBeenRevoked(commitment));

    // CRE write-path adapter (ComplianceGateReceiver), when deployed.
    try {
      const receiverDeployment = JSON.parse(
        readFileSync(join(__dirname, "..", "deployments", "sepolia", "ComplianceGateReceiver.json"), "utf8"),
      );
      const receiver = new ethers.Contract(receiverDeployment.address, receiverDeployment.abi, provider);
      console.log("ComplianceGateReceiver:", receiverDeployment.address);
      console.log("  trusted forwarder:", await receiver.getForwarderAddress());
      console.log("  complianceGate   :", await receiver.complianceGate());
      console.log("  owner            :", await receiver.owner());
    } catch {
      console.log("ComplianceGateReceiver: not recorded in deployments/sepolia");
    }
    return;
  }

  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY is required for issue/revoke actions");
  }

  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const gateWriter = gate.connect(wallet);
  const commitment = BigInt(DEMO_COMMITMENT);

  if (action === "issue") {
    if (await gateWriter.isMember(commitment)) {
      console.log("Commitment is already a member:", DEMO_COMMITMENT);
      return;
    }
    const tx = await gateWriter.issueCredential(commitment);
    const receipt = await tx.wait();
    console.log("issueCredential tx:", receipt.hash);
  } else if (action === "revoke") {
    const leaves: bigint[] = await gate.getLeaves();
    const group = new Group(leaves.map(value => BigInt(value)));
    const memberIndex = group.indexOf(commitment);
    if (memberIndex < 0) {
      throw new Error("Commitment is missing from the on-chain Merkle leaves");
    }
    const merkleProofSiblings = group.generateMerkleProof(memberIndex).siblings.map(value => BigInt(value));
    const tx = await gateWriter.revokeCredentialWithMerkleProof(commitment, merkleProofSiblings);
    const receipt = await tx.wait();
    console.log("revokeCredentialWithMerkleProof tx:", receipt.hash);
  } else {
    throw new Error(`Unknown action: ${action}. Use status | issue | revoke`);
  }

  const members = await gate.getMembers();
  console.log(
    "members after action:",
    members.map((value: bigint) => value.toString()),
  );
  console.log("hasBeenRevoked(demo):", await gate.hasBeenRevoked(commitment));
}

main().catch(error => {
  console.error("Sepolia smoke demo failed:", error);
  process.exit(1);
});
