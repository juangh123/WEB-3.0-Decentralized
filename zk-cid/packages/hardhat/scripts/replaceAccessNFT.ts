/**
 * Deploys the current AccessNFT source (with access revocation: revokeAccess / restoreAccess /
 * isValid) on an already-deployed ComplianceGate and rewires the gate to it.
 *
 * This is the "bring the live deployment in line with the fixed source" step for the H5 audit
 * finding. It refuses to run when the existing AccessNFT has already minted tokens (replacing it
 * would orphan them).
 *
 * Usage (from packages/hardhat):
 *   tsx scripts/replaceAccessNFT.ts
 *
 * Required env: DEPLOYER_PRIVATE_KEY (the on-chain gate issuer).
 */
import "dotenv/config";
import { ethers } from "ethers";
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { getDeployerWallet } from "./deployerWallet.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const rpcUrl =
    process.env.SEPOLIA_RPC_URL ??
    (process.env.ALCHEMY_API_KEY
      ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      : "https://ethereum-sepolia-rpc.publicnode.com");

  const deploymentsDir = join(__dirname, "..", "deployments", "sepolia");
  const gateDeployment = JSON.parse(readFileSync(join(deploymentsDir, "ComplianceGate.json"), "utf8"));
  const oldNftDeployment = JSON.parse(readFileSync(join(deploymentsDir, "AccessNFT.json"), "utf8"));
  const artifact = JSON.parse(
    readFileSync(join(__dirname, "..", "artifacts", "contracts", "AccessNFT.sol", "AccessNFT.json"), "utf8"),
  );

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = await getDeployerWallet(provider, "replace AccessNFT");
  const gate = new ethers.Contract(gateDeployment.address, gateDeployment.abi, wallet);

  const onChainIssuer = await gate.issuer();
  if (onChainIssuer.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`configured key ${wallet.address} is not the gate issuer ${onChainIssuer}`);
  }

  const oldNft = new ethers.Contract(oldNftDeployment.address, oldNftDeployment.abi, provider);
  const minted = await oldNft.nextTokenId();
  if (minted !== 0n) {
    throw new Error(
      `refusing to replace AccessNFT: the existing contract already minted ${minted} token(s) at ${oldNftDeployment.address}`,
    );
  }

  const hasRevocationApi = artifact.abi.some((entry: { name?: string }) => entry.name === "revokeAccess");
  if (!hasRevocationApi) {
    throw new Error("compiled AccessNFT artifact is stale: run `yarn hardhat:compile` first (missing revokeAccess)");
  }

  console.log("issuer       :", wallet.address);
  console.log("gate         :", gateDeployment.address);
  console.log("old AccessNFT:", oldNftDeployment.address, "(minted 0)");

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const nft = await factory.deploy(gateDeployment.address);
  const deployTx = nft.deploymentTransaction();
  console.log("deploy tx    :", deployTx?.hash);
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  const deployReceipt = await deployTx?.wait();
  console.log("new AccessNFT:", nftAddress);
  // Cast to `any`: contract instances built from a JSON artifact ABI expose their methods
  // through an index signature that the static type does not describe.
  const nftContract = nft as any;

  await (await gate.setAccessNFT(nftAddress)).wait();
  console.log("setAccessNFT done");
  await (await gate.setVerifier(oldNftDeployment.address, false)).wait();
  console.log("old verifier disabled");
  await (await gate.setVerifier(nftAddress, true)).wait();
  console.log("new verifier enabled");

  const [gateAccessNft, newIsVerifier, oldIsVerifier, nftGate] = await Promise.all([
    gate.accessNFT(),
    gate.verifiers(nftAddress),
    gate.verifiers(oldNftDeployment.address),
    nftContract.complianceGate(),
  ]);
  if (gateAccessNft.toLowerCase() !== nftAddress.toLowerCase()) throw new Error("gate.accessNFT assertion failed");
  if (!newIsVerifier) throw new Error("new AccessNFT is not registered as verifier");
  if (oldIsVerifier) throw new Error("old AccessNFT is still registered as verifier");
  if (nftGate.toLowerCase() !== gateDeployment.address.toLowerCase())
    throw new Error("nft.complianceGate assertion failed");

  const record = {
    address: nftAddress,
    abi: artifact.abi,
    receipt: deployReceipt
      ? { blockNumber: deployReceipt.blockNumber, transactionHash: deployReceipt.hash }
      : undefined,
  };
  writeFileSync(join(deploymentsDir, "AccessNFT.json"), JSON.stringify(record, null, 2) + "\n", "utf8");
  console.log("wrote deployments/sepolia/AccessNFT.json");
  console.log("done: gate.accessNFT =", gateAccessNft);
}

main().catch(error => {
  console.error("replace AccessNFT failed:", error);
  process.exit(1);
});
