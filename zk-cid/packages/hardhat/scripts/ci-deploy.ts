import hre from "hardhat";

async function main() {
  const ethers = (hre as any).ethers;
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1. Deploy Mock Semaphore
  const mockSemaphoreFactory = await ethers.getContractFactory("MockSemaphore");
  const mockSemaphore = await mockSemaphoreFactory.deploy();
  await mockSemaphore.waitForDeployment();
  console.log("MockSemaphore deployed at:", await mockSemaphore.getAddress());

  // 2. Deploy ComplianceGate
  const gateFactory = await ethers.getContractFactory("ComplianceGate");
  const gate = await gateFactory.deploy(await mockSemaphore.getAddress());
  await gate.waitForDeployment();
  console.log("ComplianceGate deployed at:", await gate.getAddress());

  // 3. Deploy AccessNFT
  const nftFactory = await ethers.getContractFactory("AccessNFT");
  const nft = await nftFactory.deploy(await gate.getAddress());
  await nft.waitForDeployment();
  console.log("AccessNFT deployed at:", await nft.getAddress());

  // 4. Wire them together (O(1) Role Binding)
  const nftAddress = await nft.getAddress();
  await (await gate.setAccessNFT(nftAddress)).wait();
  await (await gate.setVerifier(nftAddress, true)).wait();
  // 5. Strict mode: the mock only simulates validation, demoMode must stay off so a copied
  //    deployment can never silently skip proof checks.
  await (await gate.setDemoMode(false)).wait();
  console.log("✔ AccessNFT registered as verifier; demoMode off (strict mode with the mock verifier)");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
