import "dotenv/config";
import { ethers } from "ethers";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY ?? "";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? "";
const SEPOLIA_RPC_URL = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const SEPOLIA_SEMAPHORE = "0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D";

function loadArtifact(name: string) {
  const path = join(__dirname, "..", "artifacts", "contracts", `${name}.sol`, `${name}.json`);
  return JSON.parse(readFileSync(path, "utf-8"));
}

function saveDeployment(chainId: number, name: string, address: string, receipt: ethers.TransactionReceipt | null) {
  const depDir = join(__dirname, "..", "deployments", "sepolia");
  mkdirSync(depDir, { recursive: true });
  writeFileSync(join(depDir, ".chainId"), String(chainId));
  const artifact = loadArtifact(name);
  writeFileSync(
    join(depDir, `${name}.json`),
    JSON.stringify(
      {
        address,
        abi: artifact.abi,
        receipt: receipt ? { blockNumber: receipt.blockNumber, transactionHash: receipt.hash } : undefined,
      },
      null,
      2,
    ),
  );
}

async function main() {
  if (!ALCHEMY_API_KEY || !DEPLOYER_PRIVATE_KEY) {
    throw new Error("Missing ALCHEMY_API_KEY or DEPLOYER_PRIVATE_KEY in packages/hardhat/.env");
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  const rawWallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  const deployer = new ethers.NonceManager(rawWallet);
  const deployerAddress = await deployer.getAddress();
  const chainId = (await provider.getNetwork()).chainId;

  console.log("Network:", chainId.toString());
  console.log("Deployer:", deployerAddress);
  console.log("Balance:", ethers.formatEther(await provider.getBalance(deployerAddress)), "ETH");
  console.log("Semaphore:", SEPOLIA_SEMAPHORE);

  const gateArtifact = loadArtifact("ComplianceGate");
  const GateFactory = new ethers.ContractFactory(gateArtifact.abi, gateArtifact.bytecode, deployer);
  const gate = await GateFactory.deploy(SEPOLIA_SEMAPHORE);
  await gate.waitForDeployment();
  const gateAddress = await gate.getAddress();
  const gateReceipt = await gate.deploymentTransaction()?.wait();
  console.log("ComplianceGate:", gateAddress, gateReceipt?.hash ?? "");

  const nftArtifact = loadArtifact("AccessNFT");
  const NftFactory = new ethers.ContractFactory(nftArtifact.abi, nftArtifact.bytecode, deployer);
  const nft = await NftFactory.deploy(gateAddress);
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  const nftReceipt = await nft.deploymentTransaction()?.wait();
  console.log("AccessNFT:", nftAddress, nftReceipt?.hash ?? "");

  const gateContract = new ethers.Contract(gateAddress, gateArtifact.abi, deployer);
  const tx1 = await gateContract.setAccessNFT(nftAddress);
  await tx1.wait();
  console.log("setAccessNFT done:", nftAddress);

  const tx2 = await gateContract.setVerifier(nftAddress, true);
  await tx2.wait();
  console.log("setVerifier done:", nftAddress);

  const tx3 = await gateContract.setWorkflow(deployerAddress);
  await tx3.wait();
  console.log("setWorkflow done:", deployerAddress);

  saveDeployment(Number(chainId), "ComplianceGate", gateAddress, gateReceipt);
  saveDeployment(Number(chainId), "AccessNFT", nftAddress, nftReceipt);

  console.log("Saved deployments/sepolia/*.json");
}

main().catch(err => {
  console.error("Sepolia deployment failed:", err);
  process.exit(1);
});
