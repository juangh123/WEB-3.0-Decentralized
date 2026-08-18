import { ethers } from "ethers";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// LOCAL USE ONLY: Anvil/Hardhat default account #0 private key. Never use on any live network.
const LOCAL_DEPLOYER_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const LOCAL_RPC_URL = "http://127.0.0.1:8545";

function loadArtifact(name: string) {
  const path = join(__dirname, "..", "artifacts", "contracts", `${name}.sol`, `${name}.json`);
  return JSON.parse(readFileSync(path, "utf-8"));
}

// Persist the deployed address + abi so generateTsAbis.ts can produce
// a compliant deployedContracts.ts for the frontend.
function saveDeployment(name: string, address: string) {
  const depDir = join(__dirname, "..", "deployments", "localhost");
  if (!existsSync(depDir)) mkdirSync(depDir, { recursive: true });
  writeFileSync(join(depDir, ".chainId"), "31337");
  const artifact = loadArtifact(name);
  writeFileSync(
    join(depDir, `${name}.json`),
    JSON.stringify({ address, abi: artifact.abi, receipt: { blockNumber: 0 } }, null, 2),
  );
}

async function main() {
  const provider = new ethers.JsonRpcProvider(LOCAL_RPC_URL);
  const rawWallet = new ethers.Wallet(LOCAL_DEPLOYER_PRIVATE_KEY, provider);
  const deployerAddress = rawWallet.address;
  // Use NonceManager to auto-track nonce across multiple txs
  const deployer = new ethers.NonceManager(rawWallet);

  console.log("Deployer:", deployerAddress);
  console.log("Balance:", ethers.formatEther(await provider.getBalance(deployerAddress)), "ETH");

  // First, deploy MockSemaphore (full ISemaphore implementation for ComplianceGate)
  const mockArtifact = loadArtifact("MockSemaphore");
  const MockSemaphoreFactory = new ethers.ContractFactory(mockArtifact.abi, mockArtifact.bytecode, deployer);
  const mockSemaphore = await MockSemaphoreFactory.deploy();
  await mockSemaphore.waitForDeployment();
  const semaphoreAddress = await mockSemaphore.getAddress();
  console.log("MockSemaphore deployed to:", semaphoreAddress);

  // Deploy ComplianceGate (creates its Semaphore group in the constructor)
  const gateArtifact = loadArtifact("ComplianceGate");
  const ComplianceGateFactory = new ethers.ContractFactory(gateArtifact.abi, gateArtifact.bytecode, deployer);
  const complianceGate = await ComplianceGateFactory.deploy(semaphoreAddress);
  await complianceGate.waitForDeployment();
  const complianceGateAddress = await complianceGate.getAddress();
  console.log("\n======= COMPLIANCE GATE ADDRESS =======");
  console.log(complianceGateAddress);
  console.log("=======================================\n");

  // Deploy AccessNFT
  const nftArtifact = loadArtifact("AccessNFT");
  const AccessNFTFactory = new ethers.ContractFactory(nftArtifact.abi, nftArtifact.bytecode, deployer);
  const accessNFT = await AccessNFTFactory.deploy(complianceGateAddress);
  await accessNFT.waitForDeployment();
  const accessNFTAddress = await accessNFT.getAddress();
  console.log("AccessNFT deployed to:", accessNFTAddress);

  const gate = new ethers.Contract(complianceGateAddress, gateArtifact.abi, deployer);

  // Register AccessNFT on the gate so only the NFT contract can trigger proof verification
  const txRegister = await gate.setAccessNFT(accessNFTAddress);
  await txRegister.wait();
  console.log("AccessNFT registered on gate:", accessNFTAddress);

  // Authorize AccessNFT to call verifyCompliance (onlyVerifier).
  const txVerifier = await gate.setVerifier(accessNFTAddress, true);
  await txVerifier.wait();
  console.log("AccessNFT registered as verifier:", accessNFTAddress);

  // Set CRE Workflow address on ComplianceGate (use deployer as workflow for local demo)
  const tx = await gate.setWorkflow(deployerAddress);
  await tx.wait();
  console.log("CRE Workflow set to (deployer):", deployerAddress);

  // Save addresses for the other scripts
  saveDeployment("MockSemaphore", semaphoreAddress);
  saveDeployment("ComplianceGate", complianceGateAddress);
  saveDeployment("AccessNFT", accessNFTAddress);

  console.log("\n=== Deploy Summary ===");
  console.log("MockSemaphore:    ", semaphoreAddress);
  console.log("ComplianceGate:   ", complianceGateAddress);
  console.log("AccessNFT:        ", accessNFTAddress);
}

main().catch(err => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
