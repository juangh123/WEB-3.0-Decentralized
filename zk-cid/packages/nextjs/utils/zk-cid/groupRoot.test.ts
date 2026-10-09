import { Group } from "@semaphore-protocol/group";
import { describe, expect, it } from "vitest";

const DEMO_COMMITMENT = "123456789012345678901234567890123456789";

// Live Sepolia root for ComplianceGate group 712 with stable leaves [0, 0, DEMO_COMMITMENT].
// Matches Semaphore's on-chain LeanIMT: revoked members stay in the tree as zero leaves.
const LIVE_ROOT = 19120656036690252621860078919366676338739630874061673546862425326408660196542n;

describe("Semaphore on-chain tree reconstruction", () => {
  it("keeps revoked zero leaves so the rebuilt root matches the live group", () => {
    const group = new Group(["0", "0", DEMO_COMMITMENT]);

    expect(group.root).toBe(LIVE_ROOT);
    expect(group.size).toBe(3);
  });

  it("shows that compacting the member list changes the root", () => {
    const compacted = new Group([DEMO_COMMITMENT]);

    expect(compacted.root).not.toBe(LIVE_ROOT);
    expect(compacted.root).toBe(BigInt(DEMO_COMMITMENT));
  });
});
