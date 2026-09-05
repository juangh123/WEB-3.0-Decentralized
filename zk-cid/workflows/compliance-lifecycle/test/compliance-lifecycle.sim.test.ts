/**
 * ZK-CID compliance-lifecycle CRE 工作流端到端模拟测试
 *
 * 使用 @chainlink/cre-sdk/test 的真实 TestRuntime + 能力 Mock
 * (HTTP / EVM)在同一进程内完整执行 runComplianceCheck 主逻辑:
 *
 *   cron 触发 -> 抓取制裁名单(DON 共识) -> 读取链上 getMembers()
 *   -> 求交集 -> runtime.report() 生成 DON 签名报告
 *   -> EVMClient.writeReport 模拟上链撤销
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
  encodeFunctionResult,
  hexToBytes,
  type Address,
} from "viem";
import { GATE_ABI, runComplianceCheck, type Config } from "../core";

/** 与 config.json / Sepolia 实况一致的工作流配置 */
const CFG: Config = {
  schedule: "*/5 * * * *",
  sanctionsApiUrl: "https://mock-api-topaz-zeta.vercel.app/api/sanctions-list",
  chainSelectorName: "ethereum-testnet-sepolia",
  complianceGateAddress: "0xB393C4Aace43162b170d4f6A84a60fA1AF9D1Ef3",
  gasLimit: "500000",
};

/** 当前 Sepolia 实况成员(与 mock-api seed、合约 getMembers 一致) */
const LIVE_MEMBER = 123456789012345678901234567890123456789n;

/** 注册 HTTP + EVM 能力 Mock,并返回调用计数以便断言 */
function registerMocks(opts: {
  sanctioned: string[];
  members: bigint[];
}) {
  const selector = getNetwork({ chainSelectorName: CFG.chainSelectorName })!
    .chainSelector.selector;

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
      anyUnpack(req.payload, EVM_PB.CallContractRequestSchema);
      calls.callContract += 1;
      const encoded = encodeFunctionResult({
        abi: GATE_ABI,
        functionName: "getMembers",
        result: opts.members,
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
  if (calls.callContract !== 1) {
    throw new Error(`expected 1 callContract, got ${calls.callContract}`);
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
