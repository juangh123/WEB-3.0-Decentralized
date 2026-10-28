import { useState } from "react";
import type { Identity } from "@semaphore-protocol/identity";
import type { SemaphoreProof } from "@semaphore-protocol/proof";

export const useProof = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [proof, setProof] = useState<SemaphoreProof | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Generates a Semaphore proof in the browser.
   * @param identity the user's Semaphore identity
   * @param leaves stable on-chain leaves (revoked leaves are 0 and must not be compacted)
   * @param groupId group id, also used as the proof scope
   * @param userAddress address the proof is bound to (the `message`, prevents front-running)
   */
  const generateZkProof = async (
    identity: Identity,
    leaves: string[],
    groupId: bigint | string,
    userAddress: string,
  ) => {
    setIsGenerating(true);
    setError(null);
    try {
      // 1. Rebuild exactly the on-chain group. Zero leaves must stay, or the root drifts after a revocation.
      const { Group } = await import("@semaphore-protocol/group");
      const group = new Group(leaves);

      // 2. Bind the proof to the submitting address via the message (Semaphore expects a numeric value).
      const message = BigInt(userAddress).toString();
      const scope = groupId.toString();

      // 3. Generate the proof in the browser.
      // Load the prover (and its snarkjs/WASM payload) only when a proof is actually
      // requested so the demo page does not ship ~1MB of ZK tooling on first paint.
      const { generateProof } = await import("@semaphore-protocol/proof");
      const generatedProof = await generateProof(identity, group, message, scope);

      setProof(generatedProof);
      return generatedProof;
    } catch (err: any) {
      console.error("Failed to generate ZK Proof:", err);
      setError(err.message || "Unknown error generating proof");
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const clearProof = () => {
    setProof(null);
    setError(null);
  };

  return { proof, generateZkProof, clearProof, isGenerating, error };
};
