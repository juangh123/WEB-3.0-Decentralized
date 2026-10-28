import { useCallback, useState } from "react";
import type { SemaphoreProof } from "@semaphore-protocol/proof";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { useDeployedContractInfo, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { getParsedError } from "~~/utils/scaffold-eth";
import { proofBoundAddress, toSemaphoreProofArgs } from "~~/utils/zk-cid/proofArgs";

export type DryRunState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; blockNumber: bigint; account: Address }
  | { status: "error"; message: string };

/**
 * Gas-free verification: simulates `AccessNFT.mint(proof)` with `eth_call` from the address the
 * proof is bound to. The call runs the deployed contracts end to end (sender binding, replay and
 * nullifier checks, current-root check, and the real Semaphore v4 Groth16 verifier in strict
 * mode), but nothing is broadcast, so no wallet, signature or testnet ETH is needed and the
 * nullifier is not consumed.
 */
export const useDryRunMint = () => {
  const { targetNetwork } = useTargetNetwork();
  const publicClient = usePublicClient({ chainId: targetNetwork.id });
  const { data: accessNft } = useDeployedContractInfo({ contractName: "AccessNFT" });
  const [state, setState] = useState<DryRunState>({ status: "idle" });

  const dryRun = useCallback(
    async (proof: SemaphoreProof) => {
      if (!publicClient || !accessNft) {
        setState({ status: "error", message: "Contract data is still loading. Try again in a moment." });
        return;
      }
      setState({ status: "running" });
      try {
        const account = proofBoundAddress(proof);
        const blockNumber = await publicClient.getBlockNumber();
        await publicClient.simulateContract({
          address: accessNft.address,
          abi: accessNft.abi,
          functionName: "mint",
          args: [toSemaphoreProofArgs(proof)],
          account,
          blockNumber,
        });
        setState({ status: "success", blockNumber, account });
      } catch (error) {
        setState({ status: "error", message: getParsedError(error) });
      }
    },
    [accessNft, publicClient],
  );

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { dryRunState: state, dryRun, resetDryRun: reset };
};
