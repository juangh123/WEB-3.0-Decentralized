import { ethers } from "ethers";
import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
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
  const signer = new ethers.Wallet(LOCAL_PRIVATE_KEY, provider);

  const gateAddress = loadDeployedAddress("ComplianceGate");
  const nftAddress = loadDeployedAddress("AccessNFT");
  const gateArtifact = loadArtifact("ComplianceGate");
  const nftArtifact = loadArtifact("AccessNFT");
  const gate = new ethers.Contract(gateAddress, gateArtifact.abi, provider);
  const nft = new ethers.Contract(nftAddress, nftArtifact.abi, signer);

  const members: bigint[] = await gate.getMembers();
  if (members.length === 0) {
    throw new Error("No members in the group. Issue a credential first.");
  }

  const identity = new Identity("CygWTVuKqls92T54GVJzR+8qzfZbkO73fOnNlLvhDlU=");
  const group = new Group(members.map(member => member.toString()));
  const scope = "DeFi_Protocol_A";
  const message = BigInt(signer.address);
  const proof = await generateProof(identity, group, message, scope);

  console.log("Submitting ZK proof to mint NFT...");
  console.log("Nullifier:", proof.nullifier);

  try {
    // Call AccessNFT.mint() with the SemaphoreProof struct
    const tx = await nft.mint(proof);
    const receipt = await tx.wait();

    console.log("\n========================================");
    console.log("  NFT MINTED SUCCESSFULLY!");
    console.log("========================================");
    console.log("Transaction:", receipt.hash);
    console.log("Block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());

    // Check who owns the NFT
    const nextId = await nft.nextTokenId();
    const tokenId = nextId - 1n;
    const owner = await nft.ownerOf(tokenId);
    console.log("Token ID:", tokenId.toString());
    console.log("Owner:", owner);
  } catch (e: any) {
    console.error("Mint failed:", e.shortMessage || e.message);
    if (e.data) console.error("Data:", e.data);
    if (e.reason) console.error("Reason:", e.reason);
  }
}

main().catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
