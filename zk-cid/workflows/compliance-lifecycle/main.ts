/**
 * ZK-CID 合规生命周期工作流(Chainlink CRE 赏金模块)
 *
 * 流程:Cron 定时触发 -> DON 各节点拉取 Mock 制裁名单 API(共识聚合)
 *      -> EVMClient.callContract 读取链上 getMembers()
 *      -> 对命中者生成 CRE 签名报告,经 EVMClient.writeReport
 *         调用 ComplianceGate.revokeCredential 完成链上撤销
 *
 * 本文件严格基于本机已安装的 @chainlink/cre-sdk@1.16.0 真实类型声明
 * (dist/sdk/cre、dist/sdk/runtime、dist/generated-sdk/.../client_sdk_gen)编写,
 * 不再使用任何虚构的 ctx.capabilities.* API。
 */
import {
  CronCapability,
  EVMClient,
  HTTPClient,
  Runner,
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
import {
  decodeFunctionResult,
  encodeFunctionData,
  parseAbi,
  zeroAddress,
  type Address,
} from "viem";

/** 工作流运行时配置,来自同目录 config.json(runtime.config 注入) */
type Config = {
  /** Cron 表达式,默认每 5 分钟 */
  schedule: string;
  /** Mock 制裁名单 API 地址,返回 { sanctioned: string[], source, updatedAt } */
  sanctionsApiUrl: string;
  /** cre-sdk 链选择器名称,如 ethereum-testnet-sepolia */
  chainSelectorName: string;
  /** ComplianceGate 合约地址 */
  complianceGateAddress: string;
  /** writeReport 的 gasLimit(字符串,避免 JSON 精度问题) */
  gasLimit: string;
};

const GATE_ABI = parseAbi([
  "function getMembers() view returns (uint256[])",
  "function revokeCredential(uint256 commitment, uint256[] merkleProofSiblings)",
]);

/** Mock API 的响应结构(与 mock-api/server.js 的统一 schema 对齐) */
type SanctionsResponse = {
  sanctioned?: string[];
  source?: string;
  updatedAt?: string;
};

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

/** Cron 触发的合规检查主逻辑(DON 模式执行) */
const onCronTrigger = (runtime: Runtime<Config>, _payload: CronPayload): string => {
  // config.json provides defaults; environment variables override those values
  // when the workflow is executed in different environments (local vs CRE cloud).
  const cfg: Config = {
    ...runtime.config,
    sanctionsApiUrl: process.env.SANCTIONS_API_URL ?? runtime.config.sanctionsApiUrl,
    chainSelectorName: process.env.CHAIN_SELECTOR_NAME ?? runtime.config.chainSelectorName,
    complianceGateAddress: process.env.COMPLIANCE_GATE_ADDRESS ?? runtime.config.complianceGateAddress,
  };

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

  const readCallData = encodeFunctionData({
    abi: GATE_ABI,
    functionName: "getMembers",
  });
  const readReply = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: cfg.complianceGateAddress as Address,
        data: readCallData,
      }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    })
    .result();

  const members = decodeFunctionResult({
    abi: GATE_ABI,
    functionName: "getMembers",
    data: bytesToHex(readReply.data),
  }) as readonly bigint[];
  runtime.log(`on-chain members fetched: ${members.length}`);

  // ---------- 3. 计算:制裁名单与链上成员求交集 ----------
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

  // ---------- 4. EVM 写:生成 CRE 报告并上链撤销 ----------
  // 说明:CRE 写链的真实方式是 runtime.report() 产出 DON 签名报告,
  // 再由 EVMClient.writeReport 递交给目标链。合约端 revokeCredential
  // 已具备强制效力(hasBeenRevoked 标记 + 成员数组移除)。
  // 已知限制:演示环境无 Merkle 索引器,merkleProofSiblings 传空数组,
  // 合约会跳过 Semaphore 树的链上移除,以 hasBeenRevoked 标记作为执行依据。
  const revokedList: string[] = [];
  const txHashes: string[] = [];
  for (const commitment of toRevoke) {
    const callData = encodeFunctionData({
      abi: GATE_ABI,
      functionName: "revokeCredential",
      args: [commitment, []],
    });

    const report = runtime.report(prepareReportRequest(callData)).result();
    const writeReply = evmClient
      .writeReport(runtime, {
        receiver: cfg.complianceGateAddress,
        report,
        gasConfig: { gasLimit: cfg.gasLimit },
      })
      .result();

    if (writeReply.txStatus === TxStatus.SUCCESS) {
      revokedList.push(commitment.toString());
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
    source: sanctionsData.source,
    executedAt: runtime.now().toISOString(),
  });
};

/** 工作流装配:CronCapability 触发器 + cre.handler */
const initWorkflow = (config: Config): Workflow<Config> => {
  const cron = new CronCapability();
  return [
    cre.handler(
      cron.trigger({ schedule: config.schedule }),
      onCronTrigger,
    ),
  ];
};

/** CRE Runner 入口 */
export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main();
