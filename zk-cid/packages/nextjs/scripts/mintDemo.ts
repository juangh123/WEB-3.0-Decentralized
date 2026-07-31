import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof } from "@semaphore-protocol/proof";

async function main() {
  // Use the identity that's in browser localStorage
  const identity = new Identity("CygWTVuKqls92T54GVJzR+8qzfZbkO73fOnNlLvhDlU=");
  console.log("Identity commitment:", identity.commitment.toString());

  // The member that was issued on-chain
  const members = ["5971644768800692991947631472118425334028045883019724522721770548264953610582"];
  console.log("Group members:", members);

  const group = new Group(members);
  const scope = "DeFi_Protocol_A";

  console.log("\n=== Generating ZK Proof ===");
  const fullProof = await generateProof(identity, group, scope, scope);
  console.log("Proof generated successfully!");
  console.log("Nullifier:", fullProof.nullifier.toString());
  console.log("Root:", fullProof.merkleTreeRoot.toString());
  console.log("Depth:", fullProof.merkleTreeDepth);
  console.log("Message:", fullProof.message.toString());
  console.log("Scope:", fullProof.scope.toString());
  console.log(
    "Points:",
    fullProof.points.map((p: bigint) => p.toString()),
  );

  // Output the proof as a JSON structure for direct use
  // This is the format needed for the AccessNFT.mint() call
  console.log("\n=== Mint Arguments (for ethers Contract call) ===");
  console.log(
    JSON.stringify(
      {
        merkleTreeDepth: fullProof.merkleTreeDepth,
        merkleTreeRoot: fullProof.merkleTreeRoot.toString(),
        nullifier: fullProof.nullifier.toString(),
        message: fullProof.message.toString(),
        scope: fullProof.scope.toString(),
        points: fullProof.points.map((p: bigint) => p.toString()),
      },
      null,
      2,
    ),
  );
}

main().catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
