import type { SemaphoreProof } from "@semaphore-protocol/proof";
import { type Address, bytesToHex, getAddress } from "viem";

type ProofPoints = readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];

/** The `ISemaphore.SemaphoreProof` struct expected by `AccessNFT.mint`. */
export type SemaphoreProofArgs = {
  merkleTreeDepth: bigint;
  merkleTreeRoot: bigint;
  nullifier: bigint;
  message: bigint;
  scope: bigint;
  points: ProofPoints;
};

export const toSemaphoreProofArgs = (proof: SemaphoreProof): SemaphoreProofArgs => {
  if (proof.points.length !== 8) {
    throw new Error(`A Semaphore proof has 8 points, got ${proof.points.length}`);
  }
  return {
    merkleTreeDepth: BigInt(proof.merkleTreeDepth),
    merkleTreeRoot: BigInt(proof.merkleTreeRoot),
    nullifier: BigInt(proof.nullifier),
    message: BigInt(proof.message),
    scope: BigInt(proof.scope),
    points: proof.points.map(point => BigInt(point)) as unknown as ProofPoints,
  };
};

/**
 * The address a proof is bound to. `AccessNFT.mint` requires `proof.message == msg.sender`,
 * so this is the only account that can mint (or dry-run a mint) with the proof.
 */
export const proofBoundAddress = (proof: SemaphoreProof): Address =>
  getAddress(`0x${BigInt(proof.message).toString(16).padStart(40, "0")}`);

/**
 * A random address used to bind a proof when no wallet is connected. No private key is created
 * for it, so it never sends a transaction; it only serves as the `from` of a gas-free
 * `eth_call` that checks the proof against the live contracts.
 */
export const createVerificationAddress = (): Address => {
  const bytes = new Uint8Array(20);
  globalThis.crypto.getRandomValues(bytes);
  return getAddress(bytesToHex(bytes));
};
