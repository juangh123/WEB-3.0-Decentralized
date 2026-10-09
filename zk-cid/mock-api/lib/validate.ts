/** BN254 scalar field size: commitments must be strictly below this value. */
export const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export type CommitmentValidation = { ok: true; value: string } | { ok: false; error: string };

/**
 * Validates a sanctions-list commitment.
 *
 * The CRE workflow runs `BigInt(entry)` on every list entry, so a single malformed value
 * would abort an entire compliance run. Both the Express server (`server.js`) and the Vercel
 * functions (this file) enforce the same rule; keep `server.js` in sync when it changes.
 */
export function validateCommitment(input: unknown): CommitmentValidation {
  if (typeof input !== "string" && typeof input !== "number") {
    return { ok: false, error: "commitment must be a decimal field element" };
  }

  const text = String(input).trim();
  if (!/^[0-9]{1,78}$/.test(text)) {
    return { ok: false, error: "commitment must be a decimal field element" };
  }

  let value: bigint;
  try {
    value = BigInt(text);
  } catch {
    return { ok: false, error: "commitment must be a decimal field element" };
  }

  if (value <= 0n) {
    return { ok: false, error: "commitment must be greater than zero" };
  }
  if (value >= SNARK_SCALAR_FIELD) {
    return { ok: false, error: "commitment is outside the Semaphore scalar field" };
  }

  return { ok: true, value: value.toString() };
}
