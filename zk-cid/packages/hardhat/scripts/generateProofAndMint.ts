import { ethers } from "ethers";
import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
import { generateProof } from "@semaphore-protocol/proof";
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
  // Use deployer wallet (Account #0)
  const signer = new ethers.Wallet(LOCAL_PRIVATE_KEY, provider);

  const gateAddress = loadDeployedAddress("ComplianceGate");
  const nftAddress = loadDeployedAddress("AccessNFT");

  const gateArtifact = loadArtifact("ComplianceGate");
  const nftArtifact = loadArtifact("AccessNFT");

  const gate = new ethers.Contract(gateAddress, gateArtifact.abi, signer);
  const nft = new ethers.Contract(nftAddress, nftArtifact.abi, signer);

  // Get current members
  const members = await gate.getMembers();
  console.log(
    "Members:",
    members.map((m: bigint) => m.toString()),
  );

  if (members.length === 0) {
    console.error("No members in the group! Issue a credential first.");
    process.exit(1);
  }

  // Create a Semaphore identity (same one that was issued)
  // The identity from localStorage: "CygWTVuKqls92T54GVJzR+8qzfZbkO73fOnNlLvhDlU="
  const identity = new Identity("CygWTVuKqls92T54GVJzR+8qzfZbkO73fOnNlLvhDlU=");
  console.log("\nIdentity commitment:", identity.commitment.toString());

  // Create the Semaphore group with the members
  const memberStrings = members.map((m: bigint) => m.toString());
  const group = new Group(memberStrings);

  const scope = "DeFi_Protocol_A";

  console.log("\nGenerating ZK proof...");
  const fullProof = await generateProof(identity, group, scope, scope);
  console.log("Proof generated successfully!");
  console.log("Nullifier:", fullProof.nullifier.toString());
  console.log("Root:", fullProof.merkleTreeRoot.toString());

  // Submit the proof to mint NFT
  console.log("\nSubmitting proof to mint NFT...");
  const tx = await nft.mint({
    merkleTreeDepth: fullProof.merkleTreeDepth,
    merkleTreeRoot: fullProof.merkleTreeRoot.toString(),
    nullifier: fullProof.nullifier.toString(),
    message: fullProof.message.toString(),
    scope: fullProof.scope.toString(),
    points: fullProof.points.map((p: bigint) => p.toString()),
  });

  const receipt = await tx.wait();
  console.log("\n=== NFT MINTED SUCCESSFULLY ===");
  console.log("Transaction:", receipt.hash);
  console.log("Block:", receipt.blockNumber);
  console.log("Gas used:", receipt.gasUsed.toString());

  // Check the NFT owner
  const tokenId = await nft.nextTokenId();
  console.log("Token ID:", (tokenId - 1n).toString());
}

main().catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
