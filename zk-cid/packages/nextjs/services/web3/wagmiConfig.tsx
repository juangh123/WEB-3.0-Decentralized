import { wagmiConnectors } from "./wagmiConnectors";
import { Chain, createClient, fallback, http } from "viem";
import { hardhat, mainnet, sepolia } from "viem/chains";
import { createConfig } from "wagmi";
import scaffoldConfig, { ScaffoldConfig } from "~~/scaffold.config";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth";

const { targetNetworks } = scaffoldConfig;

// Secondary fallback layer: viem's built-in Sepolia default endpoint intermittently fails CORS
// in the browser, so these explicit endpoints are tried before it. They are intentionally kept
// behind Alchemy because the public endpoints rate-limit (HTTP 429) under the demo's 3s polling.
const PUBLIC_RPC_URLS: Record<number, string[]> = {
  [sepolia.id]: ["https://ethereum-sepolia-rpc.publicnode.com"],
};

// We always want to have mainnet enabled (ENS resolution, ETH price, etc). But only once.
export const enabledChains = targetNetworks.find((network: Chain) => network.id === 1)
  ? targetNetworks
  : ([...targetNetworks, mainnet] as const);

export const wagmiConfig = createConfig({
  chains: enabledChains,
  connectors: wagmiConnectors(),
  ssr: true,
  client({ chain }) {
    // Extra fallback for mainnet.
    const mainnetFallbackWithDefaultRPC = [http("https://mainnet.rpc.buidlguidl.com")];
    const publicRpcTransports = (PUBLIC_RPC_URLS[chain.id] ?? []).map(url => http(url));
    let rpcFallbacks = [...(chain.id === mainnet.id ? mainnetFallbackWithDefaultRPC : [])];

    const rpcOverrideUrl = (scaffoldConfig.rpcOverrides as ScaffoldConfig["rpcOverrides"])?.[chain.id];

    if (rpcOverrideUrl) {
      rpcFallbacks = [http(rpcOverrideUrl), ...rpcFallbacks];
    } else {
      const alchemyHttpUrl = getAlchemyHttpUrl(chain.id);
      if (alchemyHttpUrl) {
        // Alchemy first: the shared template key is rate-limited but far more tolerant than the
        // public endpoints under this demo's polling load.
        rpcFallbacks = [http(alchemyHttpUrl), ...rpcFallbacks];
      }
    }

    rpcFallbacks = [...rpcFallbacks, ...publicRpcTransports, http()];

    return createClient({
      chain,
      transport: fallback(rpcFallbacks),
      ...(chain.id !== (hardhat as Chain).id
        ? {
            pollingInterval: scaffoldConfig.pollingInterval,
          }
        : {}),
    });
  },
});
