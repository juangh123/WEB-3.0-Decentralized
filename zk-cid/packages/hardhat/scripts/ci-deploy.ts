import hre from "hardhat";

async function main() {
  const ethers = (hre as any).ethers;
  const [deployer] = await ethers.getSigners();
  console.log("部署者地址:", deployer.address);

  // 1. Deploy Mock Semaphore
  const mockSemaphoreFactory = await ethers.getContractFactory("MockSemaphore");
  const mockSemaphore = await mockSemaphoreFactory.deploy();
  await mockSemaphore.waitForDeployment();
  console.log("MockSemaphore 部署地址:", await mockSemaphore.getAddress());

  // 2. Deploy ComplianceGate
  const gateFactory = await ethers.getContractFactory("ComplianceGate");
  const gate = await gateFactory.deploy(await mockSemaphore.getAddress());
  await gate.waitForDeployment();
  console.log("ComplianceGate 部署地址:", await gate.getAddress());

  // 3. Deploy AccessNFT
  const nftFactory = await ethers.getContractFactory("AccessNFT");
  const nft = await nftFactory.deploy(await gate.getAddress());
  await nft.waitForDeployment();
  console.log("AccessNFT 部署地址:", await nft.getAddress());

  // 4. Wire them together (O(1) Role Binding)
  const nftAddress = await nft.getAddress();
  await (await gate.setAccessNFT(nftAddress)).wait();
  await (await gate.setVerifier(nftAddress, true)).wait();
  // 5. Strict mode: the mock only simulates validation, demoMode must stay off so a copied
  //    deployment can never silently skip proof checks.
  await (await gate.setDemoMode(false)).wait();
  console.log("✔ 已配置 AccessNFT 为 Verifier，并关闭 demoMode（严格模式 + Mock 校验）");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
