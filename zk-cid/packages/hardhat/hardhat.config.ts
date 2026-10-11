import "dotenv/config";
import { defineConfig, overrideTask } from "hardhat/config";
import hardhatToolbox from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import HardhatDeploy from "hardhat-deploy";
import generateTsAbis from "./scripts/generateTsAbis.js";
import { LOCAL_PRIVATE_KEY as LOCAL_DEV_PRIVATE_KEY } from "./scripts/localDev.js";

// Local development fallback only: the well-known Anvil/Hardhat account #0 private key.
// Live networks must supply DEPLOYER_PRIVATE_KEY (or __RUNTIME_DEPLOYER_PRIVATE_KEY); without
// it they are configured without a signer, so a deploy fails loudly instead of silently using
// a public key. Generate your own with `yarn generate` / `yarn account:import`.
const configuredDeployerPrivateKey =
  process.env.DEPLOYER_PRIVATE_KEY ?? process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY;
const localAccounts = [configuredDeployerPrivateKey ?? LOCAL_DEV_PRIVATE_KEY];
const remoteAccountConfig = configuredDeployerPrivateKey
  ? { accounts: [configuredDeployerPrivateKey] }
  : {};

// API keys are read from environment variables only (no defaults shipped); see .env.example.
// You can get your own Alchemy key at https://dashboard.alchemyapi.io
const providerApiKey = process.env.ALCHEMY_API_KEY ?? "";

export const etherscanApiKey = process.env.ETHERSCAN_API_KEY ?? "";

export default defineConfig({
  plugins: [hardhatToolbox, HardhatDeploy],
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            // https://docs.soliditylang.org/en/latest/using-the-compiler.html#optimizer-options
            runs: 200,
          },
        },
      },
    ],
  },
  generateTypedArtifacts: {
    destinations: [
      {
        folder: "./generated",
        mode: "typescript",
      },
    ],
  },
  verify: {
    etherscan: {
      apiKey: etherscanApiKey,
    },
  },
  networks: {
    // View the networks that are pre-configured.
    // If the network you are looking for is not here you can add new network settings
    default: {
      type: "http",
      url: "http://127.0.0.1:8545",
      accounts: localAccounts,
    },
    hardhat: {
      type: "edr-simulated",
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${providerApiKey}`,
        enabled: process.env.MAINNET_FORKING_ENABLED === "true",
      },
    },
    mainnet: {
      type: "http",
      url: "https://mainnet.rpc.buidlguidl.com",
      ...remoteAccountConfig,
    },
    sepolia: {
      type: "http",
      url: `https://eth-sepolia.g.alchemy.com/v2/${providerApiKey}`,
      ...remoteAccountConfig,
    },
    optimism: {
      type: "http",
      url: `https://opt-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      ...remoteAccountConfig,
    },
    optimismSepolia: {
      type: "http",
      url: `https://opt-sepolia.g.alchemy.com/v2/${providerApiKey}`,
      ...remoteAccountConfig,
    },
    base: {
      type: "http",
      url: "https://mainnet.base.org",
      ...remoteAccountConfig,
    },
    baseSepolia: {
      type: "http",
      url: "https://sepolia.base.org",
      ...remoteAccountConfig,
    },
    arbitrum: {
      type: "http",
      url: `https://arb-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      ...remoteAccountConfig,
    },
    arbitrumSepolia: {
      type: "http",
      url: `https://arb-sepolia.g.alchemy.com/v2/${providerApiKey}`,
      ...remoteAccountConfig,
    },
    scrollSepolia: {
      type: "http",
      url: "https://sepolia-rpc.scroll.io",
      ...remoteAccountConfig,
    },
    scroll: {
      type: "http",
      url: "https://rpc.scroll.io",
      ...remoteAccountConfig,
    },
    celo: {
      type: "http",
      url: "https://forno.celo.org",
      ...remoteAccountConfig,
    },
    celoSepolia: {
      type: "http",
      url: "https://forno.celo-sepolia.celo-testnet.org/",
      ...remoteAccountConfig,
    },
    polygon: {
      type: "http",
      url: `https://polygon-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      ...remoteAccountConfig,
    },
    polygonAmoy: {
      type: "http",
      url: `https://polygon-amoy.g.alchemy.com/v2/${providerApiKey}`,
      ...remoteAccountConfig,
    },
    gnosis: {
      type: "http",
      url: "https://rpc.gnosischain.com",
      ...remoteAccountConfig,
    },
    chiado: {
      type: "http",
      url: "https://rpc.chiadochain.net",
      ...remoteAccountConfig,
    },
    polygonZkEvm: {
      type: "http",
      url: `https://polygonzkevm-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      ...remoteAccountConfig,
    },
    polygonZkEvmCardona: {
      type: "http",
      url: `https://polygonzkevm-cardona.g.alchemy.com/v2/${providerApiKey}`,
      ...remoteAccountConfig,
    },
  },
  tasks: [
    overrideTask("deploy")
      .setInlineAction(async (args, _hre, runSuper) => {
        await runSuper(args);
        await generateTsAbis();
      })
      .build(),
  ],
});
