import "dotenv/config";
import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof } from "@semaphore-protocol/proof";
import { ethers } from "ethers";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const gateDeployment = JSON.parse(
  readFileSync(join(__dirname, "..", "deployments", "sepolia", "ComplianceGate.json"), "utf8"),
);
const nftDeployment = JSON.parse(
  readFileSync(join(__dirname, "..", "deployments", "sepolia", "AccessNFT.json"), "utf8"),
);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function waitForMember(gate: ethers.Contract, commitment: bigint) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    if (await gate.isMember(commitment)) return;
    await sleep(2_000);
  }
  throw new Error("Issued commitment did not appear on-chain");
}

async function main() {
  const keepCredential = process.argv.includes("--keep");
  const rpcUrl =
    process.env.SEPOLIA_RPC_URL ||
    (process.env.ALCHEMY_API_KEY
      ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      : "https://ethereum-sepolia-rpc.publicnode.com");

  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY is required");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const gate = new ethers.Contract(gateDeployment.address, gateDeployment.abi, wallet);
  const nft = new ethers.Contract(nftDeployment.address, nftDeployment.abi, wallet);

  console.log("wallet:", wallet.address);
  console.log("balance:", ethers.formatEther(await provider.getBalance(wallet.address)), "ETH");
  console.log("gate:", gateDeployment.address, "nft:", nftDeployment.address);
  console.log("demoMode:", await gate.demoMode());

  const identity = new Identity();
  const commitment = identity.commitment;
  console.log("commitment:", commitment.toString());

  const demoIssueUrl = process.env.DEMO_ISSUE_URL || "https://web-3-0-decentralized.vercel.app/api/demo-issue";
  const issueResponse = await fetch(demoIssueUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ commitment: commitment.toString() }),
  });
  const issuePayload = (await issueResponse.json().catch(() => ({}))) as {
    status?: string;
    txHash?: string;
    error?: string;
  };
  console.log("demo-issue:", issueResponse.status, issuePayload);
  if (!issueResponse.ok) {
    throw new Error(issuePayload.error || `Demo issuance failed with HTTP ${issueResponse.status}`);
  }

  await waitForMember(gate, commitment);

  const groupId: bigint = await gate.groupId();
  const leaves: bigint[] = await gate.getLeaves();
  console.log("groupId:", groupId.toString());
  console.log(
    "leaves:",
    leaves.map(value => value.toString()),
  );

  const group = new Group(leaves.map(value => value.toString()));
  if (group.indexOf(commitment) < 0) {
    throw new Error("Commitment is missing from the rebuilt group");
  }

  const message = BigInt(wallet.address).toString();
  const proof = await generateProof(identity, group, message, groupId.toString());
  console.log("proof:", {
    merkleTreeDepth: proof.merkleTreeDepth,
    merkleTreeRoot: proof.merkleTreeRoot,
    nullifier: proof.nullifier,
    message: proof.message,
    scope: proof.scope,
  });

  const mintTx = await nft.mint({
    merkleTreeDepth: BigInt(proof.merkleTreeDepth),
    merkleTreeRoot: BigInt(proof.merkleTreeRoot),
    nullifier: BigInt(proof.nullifier),
    message: BigInt(proof.message),
    scope: BigInt(proof.scope),
    points: proof.points.map((value: string) => BigInt(value)) as [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
    ],
  });
  console.log("mint tx:", mintTx.hash);
  const mintReceipt = await mintTx.wait();
  console.log("mint status:", mintReceipt?.status, "gas:", mintReceipt?.gasUsed?.toString());
  console.log("nextTokenId:", (await nft.nextTokenId()).toString());
  console.log("hasMinted:", await nft.hasMinted(wallet.address));
  console.log("isValid:", await nft.isValid(wallet.address));

  if (!keepCredential) {
    const currentLeaves: bigint[] = await gate.getLeaves();
    const currentGroup = new Group(currentLeaves.map(value => value.toString()));
    const memberIndex = currentGroup.indexOf(commitment);
    if (memberIndex < 0) throw new Error("Commitment is missing before revocation");
    const siblings = currentGroup.generateMerkleProof(memberIndex).siblings.map(value => BigInt(value));

    const revokeTx = await gate.revokeCredentialWithMerkleProof(commitment, siblings);
    console.log("revoke tx:", revokeTx.hash);
    const revokeReceipt = await revokeTx.wait();
    console.log("revoke status:", revokeReceipt?.status, "gas:", revokeReceipt?.gasUsed?.toString());
  }

  const members: bigint[] = await gate.getMembers();
  const finalLeaves: bigint[] = await gate.getLeaves();
  console.log(
    "members:",
    members.map(value => value.toString()),
  );
  console.log(
    "leaves:",
    finalLeaves.map(value => value.toString()),
  );
  console.log("hasBeenRevoked:", await gate.hasBeenRevoked(commitment));
  console.log("nft nextTokenId:", (await nft.nextTokenId()).toString());
}

main().catch(error => {
  console.error("Live mint acceptance failed:", error);
  process.exit(1);
});
