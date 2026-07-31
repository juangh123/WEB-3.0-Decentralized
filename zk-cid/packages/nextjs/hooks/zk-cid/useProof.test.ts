import { useProof } from "./useProof";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Semaphore v4 protocol modules — we test the hook's state machine,
// not the actual ZK proof generation.
vi.mock("@semaphore-protocol/group", () => ({
  Group: vi.fn().mockImplementation((members: string[]) => ({
    members,
  })),
}));

vi.mock("@semaphore-protocol/identity", () => ({
  Identity: vi.fn(),
}));

vi.mock("@semaphore-protocol/proof", () => ({
  generateProof: vi.fn(),
}));

describe("useProof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns initial state with null proof and no error", () => {
    const { result } = renderHook(() => useProof());

    expect(result.current.proof).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isGenerating).toBe(false);
  });

  it("sets isGenerating to true during proof generation", async () => {
    const { generateProof } = await import("@semaphore-protocol/proof");
    // Make generateProof hang so we can observe the loading state
    (generateProof as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useProof());
    const identity = { getCommitment: () => "0x123" } as any;

    act(() => {
      result.current.generateZkProof(identity, ["0x1", "0x2"], "1", "0xabc");
    });

    expect(result.current.isGenerating).toBe(true);
  });

  it("clears state via clearProof", async () => {
    const { generateProof } = await import("@semaphore-protocol/proof");
    (generateProof as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      merkleTreeDepth: 1,
      merkleTreeRoot: 0n,
      nullifier: 0n,
      message: 0n,
      scope: 0n,
      points: [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n],
    });

    const { result } = renderHook(() => useProof());
    const identity = { getCommitment: () => "0x123" } as any;

    await act(async () => {
      await result.current.generateZkProof(identity, ["0x1"], "1", "0xabc");
    });

    expect(result.current.proof).not.toBeNull();

    act(() => {
      result.current.clearProof();
    });

    expect(result.current.proof).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("sets error when generateProof rejects", async () => {
    const { generateProof } = await import("@semaphore-protocol/proof");
    (generateProof as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("ZK generation failed"));

    const { result } = renderHook(() => useProof());
    const identity = { getCommitment: () => "0x123" } as any;

    await act(async () => {
      await result.current.generateZkProof(identity, ["0x1"], "1", "0xabc");
    });

    expect(result.current.error).toBe("ZK generation failed");
    expect(result.current.proof).toBeNull();
    expect(result.current.isGenerating).toBe(false);
  });
});
