import { DeployFunction } from "hardhat-deploy/types";
import { createRequire } from "module";
const customRequire = createRequire(import.meta.url);

const deployContracts: DeployFunction = async function (hreArg: any) {
  let deploy;
  if (hreArg.deployments && typeof hreArg.deployments.deploy === "function") {
    deploy = hreArg.deployments.deploy;
  } else if (typeof hreArg.deploy === "function") {
    deploy = hreArg.deploy;
  } else {
    // Scaffold-ETH 3 Rocketh fallback
    deploy = async (name: string, options: any) => {
      const ethers = (hreArg as any).ethers;
      let factory;
      if (ethers) {
        let signer;
        try {
          const signers = await ethers.getSigners();
          signer = signers.find((s: any) => s.address === options.from) || signers[0];
        } catch {
          // Fallback for errors
        }

        factory = await ethers.getContractFactory(name, signer);
      } else {
        const ethersInstance = await import("ethers");
        const provider = new ethersInstance.JsonRpcProvider("http://127.0.0.1:8545");
        const signer = await provider.getSigner(options.from);
        factory = new ethersInstance.ContractFactory(
          customRequire(`../artifacts/contracts/${name}.sol/${name}.json`).abi,
          customRequire(`../artifacts/contracts/${name}.sol/${name}.json`).bytecode,
          signer,
        );
      }
      // Pass options.from overrides if available
      const deployOverrides = options.from ? { from: options.from } : {};
      const contract = await factory.deploy(...(options.args || []), deployOverrides);
      await contract.waitForDeployment();
      // Save deployment to generic json locally for other tools
      const fs = customRequire("fs");
      const path = customRequire("path");
      // Hack string replacement to avoid __dirname issue in ESM
      const depDir = path.join(process.cwd(), "deployments", "localhost");
      if (!fs.existsSync(depDir)) fs.mkdirSync(depDir, { recursive: true });
      fs.writeFileSync(
        path.join(depDir, `${name}.json`),
        JSON.stringify({ address: await contract.getAddress() }, null, 2),
      );

      return { address: await contract.getAddress() };
    };
  }
  const deployer = process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY
    ? new hreArg.ethers.Wallet(process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY).address
    : "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  // Since Semaphore contracts are large and complex to deploy locally in tests without their script,
  // we will use the official deployed Semaphore address on Sepolia if we are on Sepolia,
  // or a mock for local testing.

  // For this hackathon, we assume Sepolia for the final demo.
  // Semaphore v4 address on Sepolia: 0x1e0f2cb83a45c7112040cefbce5aefdb0bf310b8
  const network = hreArg.network.name;
  let semaphoreAddress = "0x1e0f2cb83a45c7112040cefbce5aefdb0bf310b8"; // Sepolia address

  if (network === "localhost" || network === "hardhat") {
    // For local anvil/hardhat tests, use the mock Semaphore which is smaller
    const mockSemaphore = await deploy("MockSemaphore", {
      from: deployer,
      args: [],
      log: true,
      autoMine: true,
    });
    semaphoreAddress = mockSemaphore.address;
  } else {
    // Optional fallback if MockSemaphoreVerifier is used wrongly on testnets
    semaphoreAddress = "0x1e0f2cb83a45c7112040cefbce5aefdb0bf310b8";
  }

  const complianceGate = await deploy("ComplianceGate", {
    from: deployer,
    args: [semaphoreAddress],
    log: true,
    autoMine: true,
  });

  const accessNFT = await deploy("AccessNFT", {
    from: deployer,
    args: [complianceGate.address],
    log: true,
    autoMine: true,
  });

  // Wire ComplianceGate -> AccessNFT so only the NFT contract can trigger proof verification
  // (ComplianceGate.verifyCompliance reverts for any other caller).
  // We skip setting verifier dynamically here to avoid prompt-hang.
  // Configure AccessNFT as verifier manually via UI or script when needed.
  console.log(
    `[Note] Please manually call setVerifier(${accessNFT.address}, true) on ComplianceGate ${complianceGate.address}`,
  );
};

export default deployContracts;

deployContracts.tags = ["ComplianceGate", "AccessNFT"];
