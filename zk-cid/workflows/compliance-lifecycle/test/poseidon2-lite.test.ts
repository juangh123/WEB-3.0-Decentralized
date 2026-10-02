/**
 * Locks the local Poseidon(2) implementation to the reference values produced
 * by `poseidon-lite@0.3.0` (which Semaphore v4's group implementation uses).
 *
 * The reference library cannot run inside the Chainlink CRE WASM runtime
 * (it calls the browser global `atob()` while loading its constants), so the
 * workflow ships `poseidon2-lite.ts` instead. These vectors make sure the
 * replacement stays byte-for-byte compatible.
 */
import { poseidon2 as reference } from "poseidon-lite/poseidon2";
import { poseidon2 } from "../poseidon2-lite";

const VECTORS: Array<{ a: bigint; b: bigint; expected: bigint }> = [
  {
    a: 1n,
    b: 2n,
    expected: 7853200120776062878684798364095072458815029376092732009249414926327459813530n,
  },
  {
    a: 0n,
    b: 0n,
    expected: 14744269619966411208579211824598458697587494354926760081771325075741142829156n,
  },
  {
    a: 123456789012345678901234567890123456789n,
    b: 987654321098765432109876543210987654321n,
    expected: 13483188139069603399343710259218886766447333643756709864896735565322074618379n,
  },
  {
    a: 2n ** 200n,
    b: 3n ** 150n,
    expected: 16329740817712138438935577189524564342937009720435910616637007766293856789536n,
  },
];

test("poseidon2 matches the pinned reference vectors", () => {
  for (const { a, b, expected } of VECTORS) {
    const actual = poseidon2([a, b]);
    if (actual !== expected) {
      throw new Error(`poseidon2(${a}, ${b}) = ${actual}, expected ${expected}`);
    }
  }
});

test("poseidon2 matches poseidon-lite at runtime", () => {
  for (const { a, b } of VECTORS) {
    const actual = poseidon2([a, b]);
    const expected = reference([a, b]);
    if (actual !== expected) {
      throw new Error(`poseidon2(${a}, ${b}) = ${actual}, poseidon-lite says ${expected}`);
    }
  }
});

test("poseidon2 rejects the wrong arity", () => {
  let threw = false;
  try {
    poseidon2([1n]);
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error("poseidon2 should reject a single input");
  }
});
