/**
 * ZK-CID compliance-lifecycle CRE 工作流端到端模拟测试
 *
 * 使用 @chainlink/cre-sdk/test 的真实 TestRuntime + 能力 Mock
 * (HTTP / EVM)在同一进程内完整执行 runComplianceCheck 主逻辑:
 *
 *   cron 触发 -> 抓取制裁名单(DON 共识) -> 读取 getMembers()/getLeaves()
 *   -> 求交集并重建 Semaphore 树生成 siblings -> runtime.report()
 *   -> EVMClient.writeReport 模拟链上树级撤销
 *
 * 运行方式(workspace 根目录):
 *   yarn workspace compliance-lifecycle test:sim
 *
 * 说明:这是 SDK 级 TypeScript 运行时模拟,不等同于完整 CRE CLI
 * 的 `cre workflow simulate`(后者需要完整 CRE 环境)。它让评审者
 * 无需安装 CRE CLI 即可复现工作流编排逻辑的端到端执行。
 */
import { test, newTestRuntime, registerTestCapability } from "@chainlink/cre-sdk/test";
import { create } from "@bufbuild/protobuf";
import { anyPack, anyUnpack } from "@bufbuild/protobuf/wkt";
import { EVM_PB, HTTP_CLIENT_PB } from "@chainlink/cre-sdk/pb";
import { getNetwork } from "@chainlink/cre-sdk";
import {
  bytesToHex,
  decodeFunctionData,
  encodeFunctionResult,
  hexToBytes,
  type Address,
} from "viem";
import {
  GATE_ABI,
  runComplianceCheck,
  type Config,
} from "../core";

/** 与 config.json / Sepolia 实况一致的工作流配置 */
const CFG: Config = {
  schedule: "*/5 * * * *",
  sanctionsApiUrl: "https://mock-api-topaz-zeta.vercel.app/api/sanctions-list",
  chainSelectorName: "ethereum-testnet-sepolia",
  complianceGateAddress: "0x1b8ae78C37c3E29DFcB0236E1c562b3CCFA44F70",
  receiverAddress: "0xB5ad6413a16efd82b76212830f908B2D67C20425",
  gasLimit: "500000",
};

/** 当前 Sepolia 实况成员(与 mock-api seed、合约 getMembers 一致) */
const LIVE_MEMBER = 123456789012345678901234567890123456789n;
/** BN254 标量域上界(应当被工作流判为非法 commitment) */
const SNARK_SCALAR_FIELD = "21888242871839275222246405745257275088548364400416034343698204186575808495617";

/** 注册 HTTP + EVM 能力 Mock,并返回调用计数以便断言 */
function registerMocks(opts: {
  sanctioned: string[];
  members: bigint[];
  leaves?: bigint[];
  /** 模拟真实链上状态变化:每次成功的 writeReport 移除下一个命中成员 */
  applyRevocations?: boolean;
  /** 前 N 次 writeReport 直接失败(模拟交易 revert) */
  failFirstWrites?: number;
}) {
  const selector = getNetwork({ chainSelectorName: CFG.chainSelectorName })!
    .chainSelector.selector;

  let membersState = [...opts.members];
  let leavesState = [...(opts.leaves ?? opts.members)];
  let failuresRemaining = opts.failFirstWrites ?? 0;

  registerTestCapability("http-actions@1.0.0-alpha", (req) => {
    if (req.method !== "SendRequest") {
      return { response: { case: "error", value: `unknown method ${req.method}` } };
    }
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
      response: { case: "payload", value: anyPack(HTTP_CLIENT_PB.ResponseSchema, reply) },
    };
  });

  const evmCapabilityId = `evm:ChainSelector:${selector}@1.0.0`;
  const calls = { callContract: 0, writeReport: 0 };
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
        result: decoded.functionName === "getLeaves" ? leavesState : membersState,
      });
      const reply = create(EVM_PB.CallContractReplySchema, {
        data: hexToBytes(encoded),
      });
      return {
        response: { case: "payload", value: anyPack(EVM_PB.CallContractReplySchema, reply) },
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
          response: { case: "payload", value: anyPack(EVM_PB.WriteReportReplySchema, failedReply) },
        };
      }

      if (opts.applyRevocations) {
        const sanctioned = new Set(opts.sanctioned);
        const index = membersState.findIndex((member) => sanctioned.has(member.toString()));
        if (index >= 0) {
          const revoked = membersState[index];
          membersState = membersState.filter((member) => member !== revoked);
          leavesState = leavesState.map((leaf) => (leaf === revoked ? 0n : leaf));
        }
      }

      const reply = create(EVM_PB.WriteReportReplySchema, {
        txStatus: EVM_PB.TxStatus.SUCCESS,
        txHash: hexToBytes("0xdeadbeefcafebabe"),
      });
      return {
        response: { case: "payload", value: anyPack(EVM_PB.WriteReportReplySchema, reply) },
      };
    }
    return { response: { case: "error", value: `unknown method ${req.method}` } };
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
  if (!runtime.getLogs().some((l) => l.includes("on-chain members fetched: 1"))) {
    throw new Error(`missing member-fetch log: ${JSON.stringify(runtime.getLogs())}`);
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
    throw new Error(`unexpected revoked commitment: ${parsed.revokedCommitments[0]}`);
  }
  if (parsed.txHashes[0] !== "0xdeadbeefcafebabe") {
    throw new Error(`unexpected tx hash: ${parsed.txHashes[0]}`);
  }
  if (parsed.proofs.length !== 1) {
    throw new Error(`expected 1 Merkle proof, got ${parsed.proofs.length}`);
  }
  if (parsed.proofs[0].commitment !== LIVE_MEMBER.toString()) {
    throw new Error(`unexpected proof commitment: ${parsed.proofs[0].commitment}`);
  }
  if (parsed.proofs[0].siblings.length !== 1 || parsed.proofs[0].siblings[0] !== "9999999999999999999") {
    throw new Error(`unexpected Merkle siblings: ${JSON.stringify(parsed.proofs[0].siblings)}`);
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
    sanctioned: ["not-a-number", "0", "-5", SNARK_SCALAR_FIELD, LIVE_MEMBER.toString()],
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
    throw new Error(`expected 4 invalid entries, got ${parsed.invalidEntries.length}`);
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
    throw new Error(`expected 1 revoked / 1 failed, got ${parsed.revokedCount} / ${parsed.failedCount}`);
  }
  if (parsed.failed[0]?.error !== "simulated revert") {
    throw new Error(`unexpected failure reason: ${JSON.stringify(parsed.failed)}`);
  }
  if (calls.writeReport !== 2) {
    throw new Error(`expected 2 writeReport, got ${calls.writeReport}`);
  }
});
