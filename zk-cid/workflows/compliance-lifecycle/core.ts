/**
 * ZK-CID compliance-lifecycle workflow: core logic.
 *
 * This module is independent of the Runner/host so the same code runs under the CRE WASM
 * engine (`main.ts`), the official `cre workflow simulate`, and the SDK TestRuntime tests.
 *
 * Two handlers share one screening pipeline:
 *
 *   1. Cron trigger (continuous screening, handler index 0)
 *      every DON node fetches the sanctions API -> identical-result consensus
 *      -> EVMClient.callContract reads getMembers()/getLeaves() at the finalized block
 *      -> intersect -> for every hit, rebuild the Semaphore tree and produce real
 *         Merkle siblings -> runtime.report() -> EVMClient.writeReport
 *
 *   2. EVM log trigger on ComplianceGate.UserAdded (screening at issuance, handler index 1)
 *      the moment an issuer adds a commitment, the DON screens exactly that commitment
 *      against the same sanctions feed and revokes it through the same report path.
 *
 * Reports go to the ComplianceGateReceiver adapter (official ReceiverTemplate pattern),
 * which only accepts calls from the Keystone forwarder and then calls
 * ComplianceGate.revokeCredentialWithMerkleProof to remove the member from the tree.
 */
import {
  CronCapability,
  EVMClient,
  HTTPClient,
  TxStatus,
  bytesToHex,
  consensusIdenticalAggregation,
  cre,
  encodeCallMsg,
  getNetwork,
  LAST_FINALIZED_BLOCK_NUMBER,
  logTriggerConfig,
  ok,
  prepareReportRequest,
  safeJsonStringify,
  text,
  type CronPayload,
  type EVMLog,
  type HTTPSendRequester,
  type Runtime,
  type Workflow,
} from "@chainlink/cre-sdk";
import { LeanIMT } from "@zk-kit/lean-imt";
import {
  decodeFunctionResult,
  encodeFunctionData,
  encodeAbiParameters,
  parseAbi,
  toEventSelector,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { poseidon2 } from "./poseidon2-lite";

/** Runtime configuration, injected from config.json (tests pass it explicitly). */
export type Config = {
  /** Cron expression for continuous screening; default every 5 minutes. */
  schedule: string;
  /** Sanctions feed URL; returns `{ sanctioned: string[], source, updatedAt }`. */
  sanctionsApiUrl: string;
  /** cre-sdk chain selector name, e.g. `ethereum-testnet-sepolia`. */
  chainSelectorName: string;
  /** ComplianceGate contract address (read target and log-trigger source). */
  complianceGateAddress: string;
  /**
   * Report receiver (ComplianceGateReceiver adapter). `EVMClient.writeReport` delivers the
   * DON-signed report to it through the Keystone forwarder, and the adapter calls the gate's
   * revocation entry point.
   */
  receiverAddress: string;
  /** Gas limit for writeReport, as a string to avoid JSON number precision issues. */
  gasLimit: string;
  /**
   * Register the issuance-time handler (EVM log trigger on `UserAdded`). Defaults to true;
   * set to false to run the cron handler only.
   */
  screenOnIssuance?: boolean;
};

export const GATE_ABI = parseAbi([
  "function getMembers() view returns (uint256[])",
  "function getLeaves() view returns (uint256[])",
  "function revokeCredential(uint256 commitment, uint256[] merkleProofSiblings)",
  "function revokeCredentialWithMerkleProof(uint256 commitment, uint256[] merkleProofSiblings)",
  "event UserAdded(uint256 indexed commitment)",
]);

/** keccak256("UserAdded(uint256)"): topic[0] of ComplianceGate's issuance event. */
export const USER_ADDED_TOPIC: Hex = toEventSelector("UserAdded(uint256)");

/** Which handler started a screening run; echoed in the result for auditability. */
export type ScreeningTrigger = "cron" | "issuance";

export type ScreeningOptions = {
  trigger: ScreeningTrigger;
  /** Issuance runs screen exactly this commitment instead of the whole member set. */
  targetCommitment?: bigint;
  /** Transaction that emitted the triggering `UserAdded` log (issuance runs only). */
  sourceTxHash?: string;
};

/** Response shape of the sanctions feed (matches the unified mock-api schema). */
type SanctionsResponse = {
  sanctioned?: string[];
  source?: string;
  updatedAt?: string;
};

/** BN254 scalar field size: identity commitments must be strictly below this value. */
const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
/** Defensive caps for the external sanctions feed. */
const MAX_SANCTIONS_ENTRIES = 5000;
const MAX_SANCTIONS_ENTRY_LENGTH = 78;

export type SanctionsParseResult = {
  entries: string[];
  invalidEntries: string[];
};

/**
 * Validates and normalizes the sanctions feed.
 *
 * A single malformed entry must never abort the whole compliance run (that would turn any
 * write access to the feed into a denial-of-service switch), so invalid entries are dropped
 * and reported instead of throwing. Duplicates are collapsed, and values outside the BN254
 * scalar field are rejected because they can never be valid Semaphore commitments.
 */
export function parseSanctionedEntries(
  raw: readonly unknown[],
): SanctionsParseResult {
  const entries: string[] = [];
  const invalidEntries: string[] = [];
  const seen = new Set<string>();

  for (const item of raw.slice(0, MAX_SANCTIONS_ENTRIES)) {
    const textValue =
      typeof item === "string" || typeof item === "number"
        ? String(item).trim()
        : "";
    if (
      textValue.length === 0 ||
      textValue.length > MAX_SANCTIONS_ENTRY_LENGTH ||
      !/^[0-9]+$/.test(textValue)
    ) {
      invalidEntries.push((textValue || String(item)).slice(0, 32));
      continue;
    }

    let parsed: bigint;
    try {
      parsed = BigInt(textValue);
    } catch {
      invalidEntries.push(textValue.slice(0, 32));
      continue;
    }

    if (parsed <= 0n || parsed >= SNARK_SCALAR_FIELD) {
      invalidEntries.push(textValue.slice(0, 32));
      continue;
    }

    const normalized = parsed.toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    entries.push(normalized);
  }

  return { entries, invalidEntries };
}

/**
 * Rebuilds the exact Semaphore tree as represented by the contract's stable leaves.
 * Revoked leaves are zero and stay in place, which is the same semantic used by
 * Semaphore's `removeMember`.
 *
 * Implemented with `@zk-kit/lean-imt` (the tree Semaphore v4 itself uses) plus the
 * local Poseidon(2) from `poseidon2-lite.ts`, instead of
 * `@semaphore-protocol/group`. The wrapper package pulls in `poseidon-lite`,
 * whose constants are decoded with the browser global `atob()`; the CRE WASM
 * runtime has no `atob`, so importing it traps the workflow at engine start.
 */
export function buildMerkleProofSiblings(
  leaves: readonly bigint[],
  commitment: bigint,
): bigint[] {
  if (leaves.length === 0) {
    throw new Error("cannot build a Merkle proof from an empty leaf set");
  }

  const tree = new LeanIMT<bigint>(
    (a, b) => poseidon2([a, b]),
    leaves.map((value) => BigInt(value)),
  );
  const memberIndex = tree.indexOf(BigInt(commitment));
  if (memberIndex < 0) {
    throw new Error(
      `commitment ${commitment.toString()} is missing from the on-chain leaves`,
    );
  }
  return tree.generateProof(memberIndex).siblings.map((value) => BigInt(value));
}

function readUint256Array(
  evmClient: EVMClient,
  runtime: Runtime<Config>,
  cfg: Config,
  functionName: "getMembers" | "getLeaves",
): readonly bigint[] {
  const callData = encodeFunctionData({
    abi: GATE_ABI,
    functionName,
  });
  const reply = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: cfg.complianceGateAddress as Address,
        data: callData,
      }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    })
    .result();

  return decodeFunctionResult({
    abi: GATE_ABI,
    functionName,
    data: bytesToHex(reply.data),
  }) as readonly bigint[];
}

/**
 * Node-mode HTTP fetch: every DON node requests the sanctions list independently, and the
 * results must be byte-identical across nodes (`consensusIdenticalAggregation`).
 */
const fetchSanctions = (
  sendRequester: HTTPSendRequester,
  url: string,
): string => {
  const response = sendRequester.sendRequest({ url, method: "GET" }).result();
  if (!ok(response)) {
    throw new Error(`sanctions API unreachable, status=${response.statusCode}`);
  }
  return text(response);
};

/**
 * One screening run (DON mode). Decoupled from the host runtime: tests drive it with the
 * `@chainlink/cre-sdk/test` TestRuntime, production gets the real runtime from the Runner.
 *
 * Without options this is the cron run: the whole on-chain member set is screened. With
 * `options.targetCommitment` (issuance run) only that commitment is screened, and the EVM
 * reads are skipped entirely when it is not on the sanctions list.
 */
export function runComplianceCheck(
  runtime: Runtime<Config>,
  cfg: Config,
  options: ScreeningOptions = { trigger: "cron" },
): string {
  const { trigger, targetCommitment, sourceTxHash } = options;

  // ---------- 1. HTTP: fetch the sanctions list (DON consensus) ----------
  const httpClient = new HTTPClient();
  const body = httpClient
    .sendRequest(
      runtime,
      fetchSanctions,
      consensusIdenticalAggregation<string>(),
    )(cfg.sanctionsApiUrl)
    .result();

  const sanctionsData = JSON.parse(body) as SanctionsResponse;
  const rawSanctioned = Array.isArray(sanctionsData.sanctioned)
    ? sanctionsData.sanctioned
    : [];
  const { entries: sanctionedList, invalidEntries } =
    parseSanctionedEntries(rawSanctioned);
  runtime.log(
    `sanctions list fetched: ${sanctionedList.length} valid entries ` +
      `(skipped ${invalidEntries.length} invalid, source=${sanctionsData.source ?? "unknown"})`,
  );
  const sanctionedSet = new Set(sanctionedList);

  // Issuance runs: a commitment that is not on the list needs no on-chain work at all.
  if (
    targetCommitment !== undefined &&
    !sanctionedSet.has(targetCommitment.toString())
  ) {
    runtime.log(
      `issuance screening commitment=${targetCommitment.toString()} result=clear`,
    );
    return safeJsonStringify({
      status: "clear",
      trigger,
      commitment: targetCommitment.toString(),
      sourceTxHash,
      message:
        "Newly issued commitment is not on the sanctions list. No action taken.",
      invalidEntries,
      source: sanctionsData.source,
      checkedAt: runtime.now().toISOString(),
    });
  }
  if (targetCommitment !== undefined) {
    runtime.log(
      `issuance screening commitment=${targetCommitment.toString()} result=sanctioned`,
    );
  }

  // ---------- 2. EVM read: current on-chain member set ----------
  const network = getNetwork({ chainSelectorName: cfg.chainSelectorName });
  if (!network) {
    throw new Error(
      `unsupported chain selector name: ${cfg.chainSelectorName}`,
    );
  }
  const evmClient = new EVMClient(network.chainSelector.selector);

  const members = readUint256Array(evmClient, runtime, cfg, "getMembers");
  runtime.log(`on-chain members fetched: ${members.length}`);

  // ---------- 3. EVM read: stable Merkle leaves, needed for the on-chain removal proof ----------
  const leaves = readUint256Array(evmClient, runtime, cfg, "getLeaves");
  const activeLeaves = leaves.filter((leaf) => leaf !== 0n);
  const activeLeafSet = new Set(activeLeaves.map((leaf) => leaf.toString()));
  const membersMatchLeaves =
    activeLeaves.length === members.length &&
    members.every((member) => activeLeafSet.has(member.toString()));
  if (!membersMatchLeaves) {
    throw new Error(
      `on-chain state mismatch: ${members.length} active members but ${activeLeaves.length} non-zero leaves`,
    );
  }
  runtime.log(
    `on-chain leaves fetched: ${leaves.length} (${activeLeaves.length} active)`,
  );

  // ---------- 4. Compute: intersect the sanctions list with the on-chain members ----------
  const toRevoke = members.filter(
    (member) =>
      sanctionedSet.has(member.toString()) &&
      (targetCommitment === undefined || member === targetCommitment),
  );

  if (toRevoke.length === 0) {
    if (targetCommitment !== undefined) {
      // Flagged, but not an active member at the finalized block: already revoked, or the
      // issuance is not final yet. The cron handler re-screens on its next run either way.
      return safeJsonStringify({
        status: "skipped",
        trigger,
        commitment: targetCommitment.toString(),
        sourceTxHash,
        message:
          "Commitment is sanctioned but not an active member at the finalized block; the cron run will re-check it.",
        checkedMembers: members.length,
        invalidEntries,
        checkedAt: runtime.now().toISOString(),
      });
    }
    return safeJsonStringify({
      status: "ok",
      message:
        invalidEntries.length > 0
          ? `No sanctioned members found (${invalidEntries.length} invalid sanction entries were skipped).`
          : "No sanctioned members found. All credentials remain valid.",
      checkedMembers: members.length,
      invalidEntries,
      checkedAt: runtime.now().toISOString(),
    });
  }

  // ---------- 5. EVM write: exact Merkle proof, then on-tree removal via a DON report ----------
  // CRE writes on-chain by producing a DON-signed report with runtime.report() and handing
  // it to EVMClient.writeReport, which submits it through the Keystone forwarder.
  const revokedList: string[] = [];
  const failedList: Array<{ commitment: string; error: string }> = [];
  const txHashes: string[] = [];
  const proofs: Array<{ commitment: string; siblings: string[] }> = [];

  // Every successful revocation rewrites one leaf and therefore changes the group root, which
  // invalidates sibling paths computed from the previous snapshot. Re-read on-chain state
  // between writes instead of reusing a single `leaves` snapshot for the whole batch —
  // otherwise only the first member of a multi-hit batch can be revoked.
  let currentLeaves = leaves;
  let currentMembers = members;

  for (let index = 0; index < toRevoke.length; index += 1) {
    const commitment = toRevoke[index];
    const commitmentStr = commitment.toString();

    if (!currentMembers.some((member) => member === commitment)) {
      // Contract already removed this member (issuer or a previous run) — nothing left to do.
      runtime.log(
        `revoke skipped commitment=${commitmentStr} reason=no-longer-a-member`,
      );
      continue;
    }

    let merkleProofSiblings: bigint[];
    try {
      merkleProofSiblings = buildMerkleProofSiblings(currentLeaves, commitment);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failedList.push({
        commitment: commitmentStr,
        error: `merkle proof failed: ${message}`,
      });
      runtime.log(`revoke failed commitment=${commitmentStr} error=${message}`);
      continue;
    }

    runtime.log(
      `merkle proof generated commitment=${commitmentStr} siblingCount=${merkleProofSiblings.length}`,
    );

    // The receiver adapter decodes `(uint256 commitment, uint256[] siblings)`,
    // so the report payload is a plain ABI encoding rather than call data.
    const payload = encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint256[]" }],
      [commitment, merkleProofSiblings],
    );

    const report = runtime.report(prepareReportRequest(payload)).result();
    const writeReply = evmClient
      .writeReport(runtime, {
        receiver: cfg.receiverAddress,
        report,
        gasConfig: { gasLimit: cfg.gasLimit },
      })
      .result();

    if (writeReply.txStatus === TxStatus.SUCCESS) {
      revokedList.push(commitmentStr);
      proofs.push({
        commitment: commitmentStr,
        siblings: merkleProofSiblings.map((value) => value.toString()),
      });
      txHashes.push(writeReply.txHash ? bytesToHex(writeReply.txHash) : "");
      runtime.log(`revoked commitment=${commitmentStr}`);
    } else {
      const error =
        writeReply.errorMessage ?? `tx status ${writeReply.txStatus}`;
      failedList.push({ commitment: commitmentStr, error });
      runtime.log(`revoke failed commitment=${commitmentStr} error=${error}`);
    }

    // Refresh the snapshot for the next write. A failed write may also mean a concurrent
    // change (issuer revocation), so re-read in both cases.
    if (index < toRevoke.length - 1) {
      currentMembers = readUint256Array(evmClient, runtime, cfg, "getMembers");
      currentLeaves = readUint256Array(evmClient, runtime, cfg, "getLeaves");
    }
  }

  const status =
    failedList.length === 0
      ? "revoked"
      : revokedList.length > 0
        ? "partial"
        : "failed";
  if (failedList.length > 0) {
    runtime.log(
      `revocation finished with failures: revoked=${revokedList.length} failed=${failedList.length}`,
    );
  }

  return safeJsonStringify({
    status,
    trigger,
    ...(sourceTxHash ? { sourceTxHash } : {}),
    revokedCount: revokedList.length,
    failedCount: failedList.length,
    failed: failedList,
    invalidEntries,
    revokedCommitments: revokedList,
    txHashes,
    proofs,
    source: sanctionsData.source,
    executedAt: runtime.now().toISOString(),
  });
}

/**
 * Effective config: config.json values, optionally overridden by environment variables for
 * local runs. The CRE WASM runtime has no Node `process` global, so read it defensively; in
 * production the values always come from config.json.
 */
const resolveConfig = (runtime: Runtime<Config>): Config => {
  const env: Record<string, string | undefined> =
    typeof process !== "undefined" && process.env ? process.env : {};

  return {
    ...runtime.config,
    sanctionsApiUrl: env.SANCTIONS_API_URL ?? runtime.config.sanctionsApiUrl,
    chainSelectorName:
      env.CHAIN_SELECTOR_NAME ?? runtime.config.chainSelectorName,
    complianceGateAddress:
      env.COMPLIANCE_GATE_ADDRESS ?? runtime.config.complianceGateAddress,
    receiverAddress: env.RECEIVER_ADDRESS ?? runtime.config.receiverAddress,
  };
};

/** Cron handler: continuous screening of the whole on-chain member set. */
export const onCronTrigger = (
  runtime: Runtime<Config>,
  _payload: CronPayload,
): string =>
  runComplianceCheck(runtime, resolveConfig(runtime), { trigger: "cron" });

/**
 * Decodes the commitment from a `UserAdded(uint256 indexed commitment)` log. Returns null for
 * logs that do not come from the configured gate or do not carry the expected topics, so a
 * misrouted log can never trigger a revocation.
 */
export function decodeUserAddedLog(
  log: EVMLog,
  gateAddress: string,
): bigint | null {
  if (log.removed) return null;
  if (bytesToHex(log.address).toLowerCase() !== gateAddress.toLowerCase())
    return null;
  if (log.topics.length < 2) return null;
  if (
    bytesToHex(log.topics[0]).toLowerCase() !== USER_ADDED_TOPIC.toLowerCase()
  )
    return null;
  const commitment = BigInt(bytesToHex(log.topics[1]));
  return commitment > 0n ? commitment : null;
}

/**
 * Log handler: screening at issuance. Runs when ComplianceGate emits `UserAdded` and screens
 * only the newly issued commitment, so a sanctioned identity is revoked without waiting for
 * the next cron tick.
 */
export const onCredentialIssued = (
  runtime: Runtime<Config>,
  log: EVMLog,
): string => screenIssuanceLog(runtime, resolveConfig(runtime), log);

/** Issuance screening with an explicit config (the handler above resolves it from the runtime). */
export function screenIssuanceLog(
  runtime: Runtime<Config>,
  cfg: Config,
  log: EVMLog,
): string {
  const sourceTxHash = log.txHash?.length ? bytesToHex(log.txHash) : undefined;
  const commitment = decodeUserAddedLog(log, cfg.complianceGateAddress);
  if (commitment === null) {
    runtime.log(
      `issuance log ignored (not a UserAdded event from the gate) tx=${sourceTxHash ?? "unknown"}`,
    );
    return safeJsonStringify({
      status: "ignored",
      trigger: "issuance",
      sourceTxHash,
      message:
        "Log is not a UserAdded event from the configured ComplianceGate.",
    });
  }
  runtime.log(
    `issuance event received commitment=${commitment.toString()} tx=${sourceTxHash ?? "unknown"}`,
  );
  return runComplianceCheck(runtime, cfg, {
    trigger: "issuance",
    targetCommitment: commitment,
    sourceTxHash,
  });
}

/**
 * Workflow wiring. Handler order defines `--trigger-index` for `cre workflow simulate`:
 *   0 = cron (continuous screening), 1 = EVM log trigger on UserAdded (screening at issuance).
 *
 * The log trigger waits for FINALIZED confidence because the workflow reads the gate at the
 * last finalized block; reacting to an unfinalized log would build the Merkle proof against
 * a tree that does not contain the new leaf yet.
 */
export const initWorkflow = (config: Config): Workflow<Config> => {
  const cron = new CronCapability();
  const handlers: Array<Workflow<Config>[number]> = [
    cre.handler(cron.trigger({ schedule: config.schedule }), onCronTrigger),
  ];

  if (config.screenOnIssuance !== false) {
    const network = getNetwork({ chainSelectorName: config.chainSelectorName });
    if (!network) {
      throw new Error(
        `unsupported chain selector name: ${config.chainSelectorName}`,
      );
    }
    const evmClient = new EVMClient(network.chainSelector.selector);
    handlers.push(
      cre.handler(
        evmClient.logTrigger(
          logTriggerConfig({
            addresses: [config.complianceGateAddress as Hex],
            topics: [[USER_ADDED_TOPIC]],
            confidence: "FINALIZED",
          }),
        ),
        onCredentialIssued,
      ),
    );
  }

  return handlers;
};
