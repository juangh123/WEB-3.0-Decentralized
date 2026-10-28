/**
 * ZK-CID compliance-lifecycle: end-to-end CRE workflow simulation tests.
 *
 * Uses the real TestRuntime from @chainlink/cre-sdk/test plus capability mocks (HTTP / EVM)
 * to execute the production `core.ts` logic in-process:
 *
 *   cron trigger -> fetch the sanctions list (DON consensus) -> read getMembers()/getLeaves()
 *   -> intersect, rebuild the Semaphore tree, produce Merkle siblings -> runtime.report()
 *   -> EVMClient.writeReport performs the simulated on-tree revocation
 *
 *   issuance log (UserAdded) -> screen only the new commitment -> same report path
 *
 * Run from the workspace root:
 *   yarn workspace compliance-lifecycle test:sim
 *
 * Note: this is an SDK-level TypeScript runtime simulation, not the official CRE CLI
 * `cre workflow simulate` (see evidence/README.md for the CLI runs). It lets reviewers
 * reproduce the orchestration end to end without installing the CRE CLI.
 */
import {
  test,
  newTestRuntime,
  registerTestCapability,
} from "@chainlink/cre-sdk/test";
import { create } from "@bufbuild/protobuf";
import { anyPack, anyUnpack } from "@bufbuild/protobuf/wkt";
import { EVM_PB, HTTP_CLIENT_PB } from "@chainlink/cre-sdk/pb";
import { getNetwork } from "@chainlink/cre-sdk";
import {
  bytesToHex,
  decodeFunctionData,
  encodeFunctionResult,
  hexToBytes,
  numberToHex,
  type Address,
  type Hex,
} from "viem";
import {
  GATE_ABI,
  USER_ADDED_TOPIC,
  initWorkflow,
  runComplianceCheck,
  screenIssuanceLog,
  type Config,
} from "../core";

/** Workflow config matching config.json and the live Sepolia deployment. */
const CFG: Config = {
  schedule: "*/5 * * * *",
  sanctionsApiUrl: "https://mock-api-topaz-zeta.vercel.app/api/sanctions-list",
  chainSelectorName: "ethereum-testnet-sepolia",
  complianceGateAddress: "0x1b8ae78C37c3E29DFcB0236E1c562b3CCFA44F70",
  receiverAddress: "0xB5ad6413a16efd82b76212830f908B2D67C20425",
  gasLimit: "500000",
};

/** Live Sepolia demo member (same as the mock-api seed and the contract's getMembers()). */
const LIVE_MEMBER = 123456789012345678901234567890123456789n;
/** BN254 scalar field size; the workflow must reject it as an invalid commitment. */
const SNARK_SCALAR_FIELD =
  "21888242871839275222246405745257275088548364400416034343698204186575808495617";

/** Registers HTTP + EVM capability mocks and returns call counters for assertions. */
function registerMocks(opts: {
  sanctioned: string[];
  members: bigint[];
  leaves?: bigint[];
  /** Mirror real chain state: every successful writeReport removes the next sanctioned member. */
  applyRevocations?: boolean;
  /** Fail the first N writeReport calls (simulated transaction revert). */
  failFirstWrites?: number;
}) {
  const selector = getNetwork({ chainSelectorName: CFG.chainSelectorName })!
    .chainSelector.selector;

  let membersState = [...opts.members];
  let leavesState = [...(opts.leaves ?? opts.members)];
  let failuresRemaining = opts.failFirstWrites ?? 0;

  const calls = { http: 0, callContract: 0, writeReport: 0 };
  registerTestCapability("http-actions@1.0.0-alpha", (req) => {
    if (req.method !== "SendRequest") {
      return {
        response: { case: "error", value: `unknown method ${req.method}` },
      };
    }
    calls.http += 1;
    anyUnpack(req.payload, HTTP_CLIENT_PB.RequestSchema);
    const body = new TextEncoder().encode(
      JSON.stringify({
        sanctioned: opts.sanctioned,
        source: "Mock OFAC SDN Sanctions List (Demo Sim)",
        updatedAt: "2026-09-03T00:00:00.000Z",
      }),
    );
    const reply = create(HTTP_CLIENT_PB.ResponseSchema, {
      statusCode: 200,
      body,
    });
    return {
      response: {
        case: "payload",
        value: anyPack(HTTP_CLIENT_PB.ResponseSchema, reply),
      },
    };
  });

  const evmCapabilityId = `evm:ChainSelector:${selector}@1.0.0`;
  registerTestCapability(evmCapabilityId, (req) => {
    if (req.method === "CallContract") {
      const request = anyUnpack(req.payload, EVM_PB.CallContractRequestSchema)!;
      calls.callContract += 1;
      const decoded = decodeFunctionData({
        abi: GATE_ABI,
        data: bytesToHex(request.call?.data ?? new Uint8Array()),
      });
      const encoded = encodeFunctionResult({
        abi: GATE_ABI,
        functionName: decoded.functionName,
        result:
          decoded.functionName === "getLeaves" ? leavesState : membersState,
      });
      const reply = create(EVM_PB.CallContractReplySchema, {
        data: hexToBytes(encoded),
      });
      return {
        response: {
          case: "payload",
          value: anyPack(EVM_PB.CallContractReplySchema, reply),
        },
      };
    }
    if (req.method === "WriteReport") {
      anyUnpack(req.payload, EVM_PB.WriteReportRequestSchema);
      calls.writeReport += 1;

      if (failuresRemaining > 0) {
        failuresRemaining -= 1;
        const failedReply = create(EVM_PB.WriteReportReplySchema, {
          txStatus: EVM_PB.TxStatus.REVERTED,
          errorMessage: "simulated revert",
        });
        return {
          response: {
            case: "payload",
            value: anyPack(EVM_PB.WriteReportReplySchema, failedReply),
          },
        };
      }

      if (opts.applyRevocations) {
        const sanctioned = new Set(opts.sanctioned);
        const index = membersState.findIndex((member) =>
          sanctioned.has(member.toString()),
        );
        if (index >= 0) {
          const revoked = membersState[index];
          membersState = membersState.filter((member) => member !== revoked);
          leavesState = leavesState.map((leaf) =>
            leaf === revoked ? 0n : leaf,
          );
        }
      }

      const reply = create(EVM_PB.WriteReportReplySchema, {
        txStatus: EVM_PB.TxStatus.SUCCESS,
        txHash: hexToBytes("0xdeadbeefcafebabe"),
      });
      return {
        response: {
          case: "payload",
          value: anyPack(EVM_PB.WriteReportReplySchema, reply),
        },
      };
    }
    return {
      response: { case: "error", value: `unknown method ${req.method}` },
    };
  });

  return calls;
}

test("sanctions list has no overlap -> credentials stay valid (status ok, no writeReport)", () => {
  const runtime = newTestRuntime();
  const calls = registerMocks({
    sanctioned: [],
    members: [LIVE_MEMBER],
  });

  const result = runComplianceCheck(runtime, CFG);
  const parsed = JSON.parse(result) as {
    status: string;
    checkedMembers: number;
  };

  if (parsed.status !== "ok") {
    throw new Error(`expected status "ok", got "${parsed.status}"`);
  }
  if (parsed.checkedMembers !== 1) {
    throw new Error(`expected 1 checked member, got ${parsed.checkedMembers}`);
  }
  if (calls.callContract !== 2) {
    throw new Error(`expected 2 callContract reads, got ${calls.callContract}`);
  }
  if (calls.writeReport !== 0) {
    throw new Error(`expected 0 writeReport, got ${calls.writeReport}`);
  }
  if (
    !runtime.getLogs().some((l) => l.includes("on-chain members fetched: 1"))
  ) {
    throw new Error(
      `missing member-fetch log: ${JSON.stringify(runtime.getLogs())}`,
    );
  }
});

test("sanctioned member intersects on-chain members -> CRE report + writeReport revokes it", () => {
  const runtime = newTestRuntime();
  const calls = registerMocks({
    sanctioned: [LIVE_MEMBER.toString()],
    members: [LIVE_MEMBER, 9999999999999999999n],
  });

  const result = runComplianceCheck(runtime, CFG);
  const parsed = JSON.parse(result) as {
    status: string;
    revokedCount: number;
    revokedCommitments: string[];
    txHashes: string[];
    proofs: Array<{ commitment: string; siblings: string[] }>;
  };

  if (parsed.status !== "revoked") {
    throw new Error(`expected status "revoked", got "${parsed.status}"`);
  }
  if (parsed.revokedCount !== 1) {
    throw new Error(`expected 1 revoked, got ${parsed.revokedCount}`);
  }
  if (parsed.revokedCommitments[0] !== LIVE_MEMBER.toString()) {
    throw new Error(
      `unexpected revoked commitment: ${parsed.revokedCommitments[0]}`,
    );
  }
  if (parsed.txHashes[0] !== "0xdeadbeefcafebabe") {
    throw new Error(`unexpected tx hash: ${parsed.txHashes[0]}`);
  }
  if (parsed.proofs.length !== 1) {
    throw new Error(`expected 1 Merkle proof, got ${parsed.proofs.length}`);
  }
  if (parsed.proofs[0].commitment !== LIVE_MEMBER.toString()) {
    throw new Error(
      `unexpected proof commitment: ${parsed.proofs[0].commitment}`,
    );
  }
  if (
    parsed.proofs[0].siblings.length !== 1 ||
    parsed.proofs[0].siblings[0] !== "9999999999999999999"
  ) {
    throw new Error(
      `unexpected Merkle siblings: ${JSON.stringify(parsed.proofs[0].siblings)}`,
    );
  }
  if (calls.writeReport !== 1) {
    throw new Error(`expected 1 writeReport, got ${calls.writeReport}`);
  }
  if (!runtime.getLogs().some((l) => l.includes("revoked commitment="))) {
    throw new Error(`missing revoke log: ${JSON.stringify(runtime.getLogs())}`);
  }
});

test("sanctioned list has no on-chain match -> no writeReport (false positive guard)", () => {
  const runtime = newTestRuntime();
  const calls = registerMocks({
    sanctioned: [LIVE_MEMBER.toString()],
    members: [7777777777777777777n],
  });

  const result = runComplianceCheck(runtime, CFG);
  const parsed = JSON.parse(result) as { status: string };

  if (parsed.status !== "ok") {
    throw new Error(`expected status "ok", got "${parsed.status}"`);
  }
  if (calls.writeReport !== 0) {
    throw new Error(`expected 0 writeReport, got ${calls.writeReport}`);
  }
});

test("multiple sanctioned members -> state is re-read between writes and the whole batch is revoked", () => {
  const runtime = newTestRuntime();
  const members = [LIVE_MEMBER, 9999999999999999999n, 7777777777777777777n];
  const calls = registerMocks({
    sanctioned: members.map((member) => member.toString()),
    members,
    applyRevocations: true,
  });

  const parsed = JSON.parse(runComplianceCheck(runtime, CFG)) as {
    status: string;
    revokedCount: number;
    failedCount: number;
    revokedCommitments: string[];
  };

  if (parsed.status !== "revoked") {
    throw new Error(`expected status "revoked", got "${parsed.status}"`);
  }
  if (parsed.revokedCount !== 3) {
    throw new Error(`expected 3 revoked, got ${parsed.revokedCount}`);
  }
  if (parsed.failedCount !== 0) {
    throw new Error(`expected 0 failed, got ${parsed.failedCount}`);
  }
  if (calls.writeReport !== 3) {
    throw new Error(`expected 3 writeReport, got ${calls.writeReport}`);
  }
  // initial getMembers + getLeaves, then a (getMembers + getLeaves) refresh after each of the
  // first two writes before the final one -> 2 + 2 * 2 = 6 reads
  if (calls.callContract !== 6) {
    throw new Error(`expected 6 callContract reads, got ${calls.callContract}`);
  }
});

test("invalid sanction entries are skipped without aborting the run", () => {
  const runtime = newTestRuntime();
  const calls = registerMocks({
    sanctioned: [
      "not-a-number",
      "0",
      "-5",
      SNARK_SCALAR_FIELD,
      LIVE_MEMBER.toString(),
    ],
    members: [LIVE_MEMBER],
    applyRevocations: true,
  });

  const parsed = JSON.parse(runComplianceCheck(runtime, CFG)) as {
    status: string;
    revokedCount: number;
    invalidEntries: string[];
  };

  if (parsed.status !== "revoked") {
    throw new Error(`expected status "revoked", got "${parsed.status}"`);
  }
  if (parsed.revokedCount !== 1) {
    throw new Error(`expected 1 revoked, got ${parsed.revokedCount}`);
  }
  if (parsed.invalidEntries.length !== 4) {
    throw new Error(
      `expected 4 invalid entries, got ${parsed.invalidEntries.length}`,
    );
  }
  if (calls.writeReport !== 1) {
    throw new Error(`expected 1 writeReport, got ${calls.writeReport}`);
  }
});

test("a failed on-chain write is reported as partial instead of a false success", () => {
  const runtime = newTestRuntime();
  const members = [LIVE_MEMBER, 9999999999999999999n];
  const calls = registerMocks({
    sanctioned: members.map((member) => member.toString()),
    members,
    applyRevocations: true,
    failFirstWrites: 1,
  });

  const parsed = JSON.parse(runComplianceCheck(runtime, CFG)) as {
    status: string;
    revokedCount: number;
    failedCount: number;
    failed: Array<{ commitment: string; error: string }>;
  };

  if (parsed.status !== "partial") {
    throw new Error(`expected status "partial", got "${parsed.status}"`);
  }
  if (parsed.revokedCount !== 1 || parsed.failedCount !== 1) {
    throw new Error(
      `expected 1 revoked / 1 failed, got ${parsed.revokedCount} / ${parsed.failedCount}`,
    );
  }
  if (parsed.failed[0]?.error !== "simulated revert") {
    throw new Error(
      `unexpected failure reason: ${JSON.stringify(parsed.failed)}`,
    );
  }
  if (calls.writeReport !== 2) {
    throw new Error(`expected 2 writeReport, got ${calls.writeReport}`);
  }
});

// ---------------------------------------------------------------------------------------
// Screening at issuance (EVM log trigger on ComplianceGate.UserAdded, handler index 1)
// ---------------------------------------------------------------------------------------

const ISSUE_TX =
  "0xc24471de9b752244089bb3818b9e7a2b61b3cf24691812ddd5b7685fd4fb3247";

/** Builds the EVM log the CRE log trigger delivers for `UserAdded(commitment)`. */
function userAddedLog(
  commitment: bigint,
  overrides: { address?: Hex; topic0?: Hex; removed?: boolean } = {},
) {
  return create(EVM_PB.LogSchema, {
    address: hexToBytes(
      (overrides.address ?? CFG.complianceGateAddress) as Hex,
    ),
    topics: [
      hexToBytes(overrides.topic0 ?? USER_ADDED_TOPIC),
      hexToBytes(numberToHex(commitment, { size: 32 })),
    ],
    txHash: hexToBytes(ISSUE_TX),
    data: new Uint8Array(),
    removed: overrides.removed ?? false,
  });
}

test("issuance of a clean commitment -> status clear, no EVM reads or writes", () => {
  const runtime = newTestRuntime();
  const fresh = 4242424242424242424242n;
  const calls = registerMocks({
    sanctioned: [LIVE_MEMBER.toString()],
    members: [LIVE_MEMBER, fresh],
  });

  const parsed = JSON.parse(
    screenIssuanceLog(runtime, CFG, userAddedLog(fresh)),
  ) as {
    status: string;
    trigger: string;
    commitment: string;
    sourceTxHash: string;
  };

  if (parsed.status !== "clear")
    throw new Error(`expected status "clear", got "${parsed.status}"`);
  if (parsed.trigger !== "issuance")
    throw new Error(`expected trigger "issuance", got "${parsed.trigger}"`);
  if (parsed.commitment !== fresh.toString())
    throw new Error(`unexpected commitment ${parsed.commitment}`);
  if (parsed.sourceTxHash !== ISSUE_TX)
    throw new Error(`unexpected source tx ${parsed.sourceTxHash}`);
  if (calls.http !== 1)
    throw new Error(`expected 1 sanctions fetch, got ${calls.http}`);
  if (calls.callContract !== 0)
    throw new Error(`expected 0 callContract reads, got ${calls.callContract}`);
  if (calls.writeReport !== 0)
    throw new Error(`expected 0 writeReport, got ${calls.writeReport}`);
});

test("issuance of a sanctioned commitment -> revoked immediately; other members are left to cron", () => {
  const runtime = newTestRuntime();
  const otherSanctioned = 7777777777777777777n;
  const calls = registerMocks({
    sanctioned: [LIVE_MEMBER.toString(), otherSanctioned.toString()],
    members: [otherSanctioned, LIVE_MEMBER],
    applyRevocations: true,
  });

  const parsed = JSON.parse(
    screenIssuanceLog(runtime, CFG, userAddedLog(LIVE_MEMBER)),
  ) as {
    status: string;
    trigger: string;
    sourceTxHash: string;
    revokedCount: number;
    revokedCommitments: string[];
    proofs: Array<{ commitment: string; siblings: string[] }>;
  };

  if (parsed.status !== "revoked")
    throw new Error(`expected status "revoked", got "${parsed.status}"`);
  if (parsed.trigger !== "issuance")
    throw new Error(`expected trigger "issuance", got "${parsed.trigger}"`);
  if (parsed.sourceTxHash !== ISSUE_TX)
    throw new Error(`unexpected source tx ${parsed.sourceTxHash}`);
  if (
    parsed.revokedCount !== 1 ||
    parsed.revokedCommitments[0] !== LIVE_MEMBER.toString()
  ) {
    throw new Error(
      `expected only the issued commitment to be revoked: ${JSON.stringify(parsed.revokedCommitments)}`,
    );
  }
  if (parsed.proofs[0].siblings[0] !== otherSanctioned.toString()) {
    throw new Error(
      `unexpected Merkle siblings: ${JSON.stringify(parsed.proofs[0].siblings)}`,
    );
  }
  if (calls.writeReport !== 1)
    throw new Error(`expected 1 writeReport, got ${calls.writeReport}`);
  if (
    !runtime
      .getLogs()
      .some(
        (l) =>
          l.includes("issuance screening") && l.includes("result=sanctioned"),
      )
  ) {
    throw new Error(
      `missing issuance screening log: ${JSON.stringify(runtime.getLogs())}`,
    );
  }
});

test("sanctioned issuance not yet visible at the finalized block -> skipped, no write", () => {
  const runtime = newTestRuntime();
  const pending = 5555555555555555555n;
  const calls = registerMocks({
    sanctioned: [pending.toString()],
    members: [LIVE_MEMBER],
  });

  const parsed = JSON.parse(
    screenIssuanceLog(runtime, CFG, userAddedLog(pending)),
  ) as { status: string };

  if (parsed.status !== "skipped")
    throw new Error(`expected status "skipped", got "${parsed.status}"`);
  if (calls.writeReport !== 0)
    throw new Error(`expected 0 writeReport, got ${calls.writeReport}`);
});

test("logs from another contract, another event, or a reorg are ignored before any capability call", () => {
  const calls = registerMocks({
    sanctioned: [LIVE_MEMBER.toString()],
    members: [LIVE_MEMBER],
  });
  const cases = [
    userAddedLog(LIVE_MEMBER, {
      address: "0x000000000000000000000000000000000000dEaD",
    }),
    userAddedLog(LIVE_MEMBER, { topic0: numberToHex(1n, { size: 32 }) }),
    userAddedLog(LIVE_MEMBER, { removed: true }),
  ];

  for (const log of cases) {
    const parsed = JSON.parse(
      screenIssuanceLog(newTestRuntime(), CFG, log),
    ) as { status: string };
    if (parsed.status !== "ignored")
      throw new Error(`expected status "ignored", got "${parsed.status}"`);
  }
  if (calls.http + calls.callContract + calls.writeReport !== 0) {
    throw new Error(
      `expected no capability calls, got ${JSON.stringify(calls)}`,
    );
  }
});

test("initWorkflow registers cron (index 0) and the UserAdded log trigger (index 1)", () => {
  const both = initWorkflow({ ...CFG, screenOnIssuance: true });
  if (both.length !== 2)
    throw new Error(`expected 2 handlers, got ${both.length}`);
  if (!both[0].trigger.capabilityId().startsWith("cron-trigger")) {
    throw new Error(
      `handler 0 should be the cron trigger, got ${both[0].trigger.capabilityId()}`,
    );
  }
  if (!both[1].trigger.capabilityId().startsWith("evm:")) {
    throw new Error(
      `handler 1 should be the EVM log trigger, got ${both[1].trigger.capabilityId()}`,
    );
  }

  const cronOnly = initWorkflow({ ...CFG, screenOnIssuance: false });
  if (cronOnly.length !== 1)
    throw new Error(
      `expected 1 handler when screenOnIssuance=false, got ${cronOnly.length}`,
    );
});
