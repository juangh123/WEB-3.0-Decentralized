import "dotenv/config";
import { ethers } from "ethers";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const GATE_ADDRESS = "0xB393C4Aace43162b170d4f6A84a60fA1AF9D1Ef3";
const DEMO_COMMITMENT = "987654321012345678901234567890123456789";

const gateArtifact = JSON.parse(
  readFileSync(join(__dirname, "..", "deployments", "sepolia", "ComplianceGate.json"), "utf8"),
);

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
    console.log(
      "members:",
      members.map((value: bigint) => value.toString()),
    );
    console.log("isMember(demo):", await gate.isMember(commitment));
    console.log("hasBeenRevoked(demo):", await gate.hasBeenRevoked(commitment));
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
    const tx = await gateWriter.revokeCredential(commitment, []);
    const receipt = await tx.wait();
    console.log("revokeCredential tx:", receipt.hash);
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
