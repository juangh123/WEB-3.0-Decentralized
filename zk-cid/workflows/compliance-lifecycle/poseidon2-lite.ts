/**
 * Minimal Poseidon(2) over the BN254 scalar field, sized for the two input
 * values that a LeanIMT node needs.
 *
 * Why this file exists: `poseidon-lite` decodes its constants with the browser
 * global `atob()`, which the Chainlink CRE WASM runtime does not provide. The
 * first call to the module therefore traps the whole workflow at engine
 * startup (`wasm trap: unreachable`). The round constants below are copied
 * verbatim from `poseidon-lite@0.3.0/constants/2.js` (t = 3, 2 inputs) and are
 * decoded here with a small dependency-free base64 reader.
 *
 * The permutation matches poseidon-lite / circomlib, so tree roots computed
 * here are identical to Semaphore v4's `@semaphore-protocol/group`.
 */
import { POSEIDON2_C, POSEIDON2_M } from "./poseidon2-lite.constants";

const FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const N_ROUNDS_F = 8;
const N_ROUNDS_P = 57; // t = 3

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const BASE64_LUT = (() => {
  const lut = new Int16Array(128).fill(-1);
  for (let i = 0; i < BASE64_ALPHABET.length; i += 1) {
    lut[BASE64_ALPHABET.charCodeAt(i)] = i;
  }
  return lut;
})();

/** Base64 -> big-endian BigInt, without relying on `atob` or `Buffer`. */
function base64ToBigInt(encoded: string): bigint {
  let accumulator = 0n;
  let bits = 0;
  let value = 0;

  for (let i = 0; i < encoded.length; i += 1) {
    const code = encoded.charCodeAt(i);
    const digit = code < 128 ? BASE64_LUT[code] : -1;
    if (digit < 0) continue; // padding ('=') and whitespace

    value = (value << 6) | digit;
    bits += 6;

    while (bits >= 8) {
      bits -= 8;
      accumulator = (accumulator << 8n) | BigInt((value >> bits) & 0xff);
    }
    // Keep only the bits that are still pending, otherwise `value` would lose
    // precision once more than ~8 base64 characters have been consumed.
    value &= (1 << bits) - 1;
  }

  // Any leftover bits are base64 padding and must be discarded: the encoded
  // length always resolves to complete bytes, so nothing is lost here.
  return accumulator;
}

const C: bigint[] = POSEIDON2_C.map(base64ToBigInt);
const M: bigint[][] = POSEIDON2_M.map(row => row.map(base64ToBigInt));

function pow5(value: bigint): bigint {
  const squared = (value * value) % FIELD;
  return (value * squared * squared) % FIELD;
}

function mix(state: bigint[]): bigint[] {
  const next: bigint[] = [];
  for (let x = 0; x < state.length; x += 1) {
    let acc = 0n;
    for (let y = 0; y < state.length; y += 1) {
      acc += M[x][y] * state[y];
    }
    next.push(acc % FIELD);
  }
  return next;
}

/** Poseidon hash of exactly two field elements (0 <= a, b < FIELD). */
export function poseidon2(inputs: readonly bigint[]): bigint {
  if (inputs.length !== 2) {
    throw new Error(`poseidon2-lite expects exactly 2 inputs, received ${inputs.length}`);
  }

  const t = 3;
  let state: bigint[] = [0n, BigInt(inputs[0]), BigInt(inputs[1])];

  for (let round = 0; round < N_ROUNDS_F + N_ROUNDS_P; round += 1) {
    for (let y = 0; y < t; y += 1) {
      state[y] += C[round * t + y];
      if (round < N_ROUNDS_F / 2 || round >= N_ROUNDS_F / 2 + N_ROUNDS_P) {
        state[y] = pow5(state[y]);
      } else if (y === 0) {
        state[y] = pow5(state[y]);
      }
    }
    state = mix(state);
  }

  return state[0];
}
