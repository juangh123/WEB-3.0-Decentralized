import { createVerificationAddress, proofBoundAddress, toSemaphoreProofArgs } from "./proofArgs";
import type { SemaphoreProof } from "@semaphore-protocol/proof";
import { isAddress } from "viem";
import { describe, expect, it } from "vitest";

const WALLET = "0x951c41D827d0A6F5b9ef4C44943E3Feb25E51348";

const makeProof = (message: string, points = 8): SemaphoreProof =>
  ({
    merkleTreeDepth: 3,
    merkleTreeRoot: "123",
    nullifier: "456",
    message,
    scope: "712",
    points: Array.from({ length: points }, (_, index) => String(index + 1)),
  }) as unknown as SemaphoreProof;

describe("proofArgs", () => {
  it("converts a Semaphore proof into the AccessNFT.mint struct", () => {
    const args = toSemaphoreProofArgs(makeProof(BigInt(WALLET).toString()));

    expect(args).toEqual({
      merkleTreeDepth: 3n,
      merkleTreeRoot: 123n,
      nullifier: 456n,
      message: BigInt(WALLET),
      scope: 712n,
      points: [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n],
    });
  });

  it("rejects a proof without exactly 8 points", () => {
    expect(() => toSemaphoreProofArgs(makeProof("1", 7))).toThrow(/8 points/);
  });

  it("recovers the checksummed address a proof is bound to", () => {
    expect(proofBoundAddress(makeProof(BigInt(WALLET).toString()))).toBe(WALLET);
  });

  it("keeps leading zero bytes when recovering the bound address", () => {
    const lowAddress = "0x0000000000000000000000000000000000000abc";
    expect(proofBoundAddress(makeProof(BigInt(lowAddress).toString())).toLowerCase()).toBe(lowAddress);
  });

  it("creates distinct valid throwaway addresses", () => {
    const first = createVerificationAddress();
    const second = createVerificationAddress();

    expect(isAddress(first)).toBe(true);
    expect(isAddress(second)).toBe(true);
    expect(first).not.toBe(second);
  });
});
