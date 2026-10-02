/**
 * ZK-CID 合规生命周期工作流核心逻辑(与 Runner/宿主无关,可被测试运行时直接驱动)
 *
 * 流程:Cron 定时触发 -> DON 各节点拉取 Mock 制裁名单 API(共识聚合)
 *      -> EVMClient.callContract 读取 getMembers()/getLeaves()
 *      -> 对命中者生成 CRE 签名报告,经 EVMClient.writeReport
 *         投递给 ComplianceGateReceiver 适配器,由它调用
 *         ComplianceGate.revokeCredentialWithMerkleProof 完成树级撤销
 *         (已部署的 gate 只授权 EOA,适配器是它的 onReport 写链入口)
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
  ok,
  prepareReportRequest,
  safeJsonStringify,
  text,
  type CronPayload,
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
  zeroAddress,
  type Address,
} from "viem";
import { poseidon2 } from "./poseidon2-lite";

/** 工作流运行时配置(config.json 注入,测试中可直接显式传入) */
export type Config = {
  /** Cron 表达式,默认每 5 分钟 */
  schedule: string;
  /** Mock 制裁名单 API 地址,返回 { sanctioned: string[], source, updatedAt } */
  sanctionsApiUrl: string;
  /** cre-sdk 链选择器名称,如 ethereum-testnet-sepolia */
  chainSelectorName: string;
  /** ComplianceGate 合约地址 */
  complianceGateAddress: string;
  /**
   * CRE 报告接收合约(ComplianceGateReceiver 适配器)。
   * `EVMClient.writeReport` 把 DON 签名的报告投递给它,由它调用 ComplianceGate
   * 的撤销入口——已部署的 gate 只认 EOA,所以需要这一层适配器。
   */
  receiverAddress: string;
  /** writeReport 的 gasLimit(字符串,避免 JSON 精度问题) */
  gasLimit: string;
};

export const GATE_ABI = parseAbi([
  "function getMembers() view returns (uint256[])",
  "function getLeaves() view returns (uint256[])",
  "function revokeCredential(uint256 commitment, uint256[] merkleProofSiblings)",
  "function revokeCredentialWithMerkleProof(uint256 commitment, uint256[] merkleProofSiblings)",
]);

/** Mock API 的响应结构(与 mock-api/server.js 的统一 schema 对齐) */
type SanctionsResponse = {
  sanctioned?: string[];
  source?: string;
  updatedAt?: string;
};

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
export function buildMerkleProofSiblings(leaves: readonly bigint[], commitment: bigint): bigint[] {
  if (leaves.length === 0) {
    throw new Error("cannot build a Merkle proof from an empty leaf set");
  }

  const tree = new LeanIMT<bigint>(
    (a, b) => poseidon2([a, b]),
    leaves.map(value => BigInt(value)),
  );
  const memberIndex = tree.indexOf(BigInt(commitment));
  if (memberIndex < 0) {
    throw new Error(`commitment ${commitment.toString()} is missing from the on-chain leaves`);
  }
  return tree.generateProof(memberIndex).siblings.map(value => BigInt(value));
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
 * 节点模式下的 HTTP 抓取函数:每个 DON 节点各自请求制裁名单,
 * 返回值经 consensusIdenticalAggregation 做全节点一致性共识。
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
 * 单次合规检查主逻辑(DON 模式执行)。
 * 与具体运行时解耦:测试环境用 @chainlink/cre-sdk/test 的 TestRuntime,
 * 生产环境由 Runner 注入真实运行时。
 */
export function runComplianceCheck(
  runtime: Runtime<Config>,
  cfg: Config,
): string {
  // ---------- 1. HTTP:拉取制裁名单(DON 共识) ----------
  const httpClient = new HTTPClient();
  const body = httpClient
    .sendRequest(runtime, fetchSanctions, consensusIdenticalAggregation<string>())(
      cfg.sanctionsApiUrl,
    )
    .result();

  const sanctionsData = JSON.parse(body) as SanctionsResponse;
  const sanctionedList = sanctionsData.sanctioned ?? [];
  runtime.log(
    `sanctions list fetched: ${sanctionedList.length} entries (source=${sanctionsData.source ?? "unknown"})`,
  );

  // ---------- 2. EVM 读:获取链上当前全部成员 ----------
  const network = getNetwork({ chainSelectorName: cfg.chainSelectorName });
  if (!network) {
    throw new Error(`unsupported chain selector name: ${cfg.chainSelectorName}`);
  }
  const evmClient = new EVMClient(network.chainSelector.selector);

  const members = readUint256Array(evmClient, runtime, cfg, "getMembers");
  runtime.log(`on-chain members fetched: ${members.length}`);

  // ---------- 3. EVM 读:获取稳定 Merkle leaves,用于生成链上移除证明 ----------
  const leaves = readUint256Array(evmClient, runtime, cfg, "getLeaves");
  const activeLeaves = leaves.filter(leaf => leaf !== 0n);
  const activeLeafSet = new Set(activeLeaves.map(leaf => leaf.toString()));
  const membersMatchLeaves =
    activeLeaves.length === members.length &&
    members.every(member => activeLeafSet.has(member.toString()));
  if (!membersMatchLeaves) {
    throw new Error(
      `on-chain state mismatch: ${members.length} active members but ${activeLeaves.length} non-zero leaves`,
    );
  }
  runtime.log(`on-chain leaves fetched: ${leaves.length} (${activeLeaves.length} active)`);

  // ---------- 4. 计算:制裁名单与链上成员求交集 ----------
  const sanctionedSet = new Set(
    sanctionedList.map((entry) => BigInt(entry).toString()),
  );
  const toRevoke = members.filter((member) =>
    sanctionedSet.has(member.toString()),
  );

  if (toRevoke.length === 0) {
    return safeJsonStringify({
      status: "ok",
      message: "No sanctioned members found. All credentials remain valid.",
      checkedMembers: members.length,
      checkedAt: runtime.now().toISOString(),
    });
  }

  // ---------- 5. EVM 写:生成精确 Merkle 证明并强制从树中移除 ----------
  // CRE 写链的真实方式是 runtime.report() 产出 DON 签名报告,
  // 再由 EVMClient.writeReport 递交给目标链。
  const revokedList: string[] = [];
  const txHashes: string[] = [];
  const proofs: Array<{ commitment: string; siblings: string[] }> = [];
  for (const commitment of toRevoke) {
    const merkleProofSiblings = buildMerkleProofSiblings(leaves, commitment);
    runtime.log(
      `merkle proof generated commitment=${commitment.toString()} siblingCount=${merkleProofSiblings.length}`,
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
      revokedList.push(commitment.toString());
      proofs.push({
        commitment: commitment.toString(),
        siblings: merkleProofSiblings.map(value => value.toString()),
      });
      txHashes.push(
        writeReply.txHash ? bytesToHex(writeReply.txHash) : "",
      );
      runtime.log(`revoked commitment=${commitment.toString()}`);
    } else {
      runtime.log(
        `revoke failed commitment=${commitment.toString()} status=${writeReply.txStatus} error=${writeReply.errorMessage ?? ""}`,
      );
    }
  }

  return safeJsonStringify({
    status: "revoked",
    revokedCount: revokedList.length,
    revokedCommitments: revokedList,
    txHashes,
    proofs,
    source: sanctionsData.source,
    executedAt: runtime.now().toISOString(),
  });
}

/**
 * Cron 触发入口:config.json 提供默认值,环境变量可覆盖
 * (本地模拟 vs CRE 云端执行使用不同 URL/链/合约地址)。
 */
export const onCronTrigger = (
  runtime: Runtime<Config>,
  _payload: CronPayload,
): string => {
  // The CRE WASM runtime has no Node `process` global, so read overrides
  // defensively: in production the values come from config.json.
  const env: Record<string, string | undefined> =
    typeof process !== "undefined" && process.env ? process.env : {};

  const cfg: Config = {
    ...runtime.config,
    sanctionsApiUrl: env.SANCTIONS_API_URL ?? runtime.config.sanctionsApiUrl,
    chainSelectorName: env.CHAIN_SELECTOR_NAME ?? runtime.config.chainSelectorName,
    complianceGateAddress: env.COMPLIANCE_GATE_ADDRESS ?? runtime.config.complianceGateAddress,
    receiverAddress: env.RECEIVER_ADDRESS ?? runtime.config.receiverAddress,
  };
  return runComplianceCheck(runtime, cfg);
};

/** 工作流装配:CronCapability 触发器 + cre.handler */
export const initWorkflow = (config: Config): Workflow<Config> => {
  const cron = new CronCapability();
  return [
    cre.handler(
      cron.trigger({ schedule: config.schedule }),
      onCronTrigger,
    ),
  ];
};
