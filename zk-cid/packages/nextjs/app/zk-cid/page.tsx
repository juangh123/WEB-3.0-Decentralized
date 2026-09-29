"use client";

import { useEffect, useMemo, useState } from "react";
import { createWalletClient, encodeFunctionData, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { useAccount } from "wagmi";
import {
  useDeployedContractInfo,
  useScaffoldReadContract,
  useScaffoldWriteContract,
  useTransactor,
} from "~~/hooks/scaffold-eth";
import { useIdentity } from "~~/hooks/zk-cid/useIdentity";
import { useProof } from "~~/hooks/zk-cid/useProof";
import { getAlchemyHttpUrl, notification } from "~~/utils/scaffold-eth";

type SanctionsPayload = {
  sanctioned: string[];
  source: string | null;
  updatedAt: string | null;
  error: string | null;
};

export default function ZKCIDDemo() {
  const { address } = useAccount();
  const {
    identity,
    createIdentity,
    createDeterministicIdentity,
    clearIdentity,
    isLoading: isIdentityLoading,
  } = useIdentity();
  const { proof, generateZkProof, isGenerating, error: proofError } = useProof();

  const [activeTab, setActiveTab] = useState<"user" | "issuer" | "verifier">("user");

  // Read the Group ID from the Contract
  const { data: groupId } = useScaffoldReadContract({
    contractName: "ComplianceGate",
    functionName: "groupId",
  });

  // Read the live member set straight from the contract. Event-history reads start at
  // block 0 on Sepolia, which public RPC endpoints reject or time out, so the demo used
  // to render "0 members" even though the on-chain group already had entries.
  const { data: onChainMembers, isLoading: isMembersLoading } = useScaffoldReadContract({
    contractName: "ComplianceGate",
    functionName: "getMembers",
  });

  const groupMembers = useMemo(() => {
    if (!onChainMembers) return [];
    return (onChainMembers as readonly bigint[]).map(member => member.toString());
  }, [onChainMembers]);
  const { data: gateContract } = useDeployedContractInfo({ contractName: "ComplianceGate" });
  const { data: issuerAddress } = useScaffoldReadContract({
    contractName: "ComplianceGate",
    functionName: "issuer",
  });
  const { data: isDemoMode } = useScaffoldReadContract({
    contractName: "ComplianceGate",
    functionName: "demoMode",
  });
  const { data: workflowAddress } = useScaffoldReadContract({
    contractName: "ComplianceGate",
    functionName: "creWorkflow",
  });

  // Optional demo issuer. When NEXT_PUBLIC_DEMO_ISSUER_KEY is set, visitors can walk the
  // full issue -> prove -> mint flow without holding the issuer wallet. Leave it unset to
  // require the real issuer (default). The key is a testnet-only credential and is exposed
  // to the browser by design, so never point this at a wallet holding real value.
  const demoIssuerKey = process.env.NEXT_PUBLIC_DEMO_ISSUER_KEY as `0x${string}` | undefined;
  const demoIssuerWallet = useMemo(() => {
    if (!demoIssuerKey || !demoIssuerKey.startsWith("0x")) return undefined;
    try {
      return createWalletClient({
        account: privateKeyToAccount(demoIssuerKey),
        chain: sepolia,
        transport: http(getAlchemyHttpUrl(sepolia.id)),
      });
    } catch {
      return undefined;
    }
  }, [demoIssuerKey]);
  const demoTransactor = useTransactor(demoIssuerWallet);

  const isIssuerWallet =
    !!address && !!issuerAddress && address.toLowerCase() === (issuerAddress as string).toLowerCase();
  // External sanctions list, fetched through the same-origin /api/sanctions proxy so the
  // browser never talks to the mock API cross-origin. This mirrors the CRE workflow data
  // source and lets visitors see the intersection with the on-chain member set.
  const [sanctions, setSanctions] = useState<SanctionsPayload | null>(null);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    fetch("/api/sanctions", { cache: "no-store", signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(payload => {
        if (!cancelled) setSanctions(payload as SanctionsPayload);
      })
      .catch(error => {
        if (!cancelled) {
          setSanctions({ sanctioned: [], source: null, updatedAt: null, error: String(error?.message ?? error) });
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const sanctionedMembers = useMemo(() => {
    if (!sanctions?.sanctioned?.length) return [];
    return groupMembers.filter(member => sanctions.sanctioned.includes(member));
  }, [groupMembers, sanctions]);
  const sanctionsUpdatedAtValue = sanctions?.updatedAt;
  const sanctionsUpdatedAt = (() => {
    if (!sanctionsUpdatedAtValue) return "—";
    const timestamp = new Date(sanctionsUpdatedAtValue);
    return Number.isNaN(timestamp.getTime())
      ? sanctionsUpdatedAtValue
      : timestamp.toLocaleString("zh-CN", { hour12: false });
  })();

  const currentCommitmentStr = identity ? identity.commitment.toString() : "";
  const isMemberInGroup = useMemo(() => {
    if (!currentCommitmentStr || groupMembers.length === 0) return false;
    return groupMembers.includes(currentCommitmentStr);
  }, [currentCommitmentStr, groupMembers]);

  const { writeContractAsync: writeComplianceGate, isPending: isIssuing } = useScaffoldWriteContract({
    contractName: "ComplianceGate",
  });

  const { data: hasMinted } = useScaffoldReadContract({
    contractName: "AccessNFT",
    functionName: "hasMinted",
    args: [address],
  });

  const handleIssueCredential = async () => {
    if (!identity) {
      notification.error("请先在 Tab 1 生成本地身份！");
      setActiveTab("user");
      return;
    }
    if (isMemberInGroup) {
      notification.info("该身份 Commitment 已经在群组中，无需重复发证！");
      return;
    }
    try {
      await writeComplianceGate({
        functionName: "issueCredential",
        args: [BigInt(identity.commitment.toString())],
      });
      notification.success("凭据发证成功！身份已加入链上 Semaphore 群组。");
    } catch (e: any) {
      console.error(e);
      notification.error(e?.message || "发证失败，请检查钱包网络与交易。");
    }
  };
  const handleDemoIssue = async () => {
    if (!identity) {
      notification.error("请先在 Tab 1 生成本地身份！");
      setActiveTab("user");
      return;
    }
    if (!demoIssuerWallet || !gateContract) return;
    try {
      await demoTransactor({
        to: gateContract.address,
        data: encodeFunctionData({
          abi: gateContract.abi,
          functionName: "issueCredential",
          args: [BigInt(identity.commitment.toString())],
        }),
      });
      notification.success("演示机构已发证上链（Demo Issuer）。");
    } catch (e: any) {
      console.error(e);
      notification.error(e?.message || "演示机构发证失败，请检查 RPC 与演示私钥配置。");
    }
  };

  const handleGenerateProof = async () => {
    if (!identity) {
      return notification.error("请先生成或连接本地身份。");
    }
    if (!address) {
      return notification.error("请先在右上角连接您的以太坊钱包。");
    }
    if (groupId === undefined) {
      return notification.error("合约 Group ID 加载中，请稍候...");
    }
    if (groupMembers.length === 0) {
      notification.error("链上群组暂无任何成员！请先前往 Tab 2 进行 KYC 发证。");
      setActiveTab("issuer");
      return;
    }
    if (!isMemberInGroup) {
      notification.error("当前身份尚未在链上群组注册！请先前往 Tab 2 完成发证。");
      setActiveTab("issuer");
      return;
    }

    try {
      const generated = await generateZkProof(identity, groupMembers, groupId, address);
      if (generated) {
        notification.success("零知识证明生成成功！现可前往 Tab 3 进行链上验证与铸造。");
      }
    } catch (err: any) {
      notification.error(err?.message || "零知识证明生成失败，请确认该身份已存在于链上群组。");
    }
  };

  const { writeContractAsync: writeAccessNFT, isPending: isVerifying } = useScaffoldWriteContract({
    contractName: "AccessNFT",
  });

  const handleVerifyProof = async () => {
    if (!proof) return notification.error("请先在 Tab 1 生成零知识证明。");
    if (!address) return notification.error("请先连接钱包。");

    try {
      await writeAccessNFT({
        functionName: "mint",
        args: [
          {
            merkleTreeDepth: BigInt(proof.merkleTreeDepth),
            merkleTreeRoot: BigInt(proof.merkleTreeRoot),
            nullifier: BigInt(proof.nullifier),
            message: BigInt(proof.message),
            scope: BigInt(proof.scope),
            points: proof.points.map(p => BigInt(p)) as [
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
            ],
          },
        ],
      });
      notification.success("合规验证通过！AccessNFT 铸造成功，已解锁 DeFi 权限。");
    } catch (e: any) {
      console.error(e);
      notification.error(e?.message || "验证或铸造失败（可能该钱包已铸造或证明无效）。");
    }
  };

  return (
    <div className="flex flex-col items-center pt-10 p-4 max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">ZK-CID 隐私合规身份实测</h1>
        <p className="text-base opacity-75 max-w-xl mx-auto">
          基于零知识证明 (Semaphore ZK) 与 Chainlink CRE 的链上合规隐私通行证与去中心化授权系统
        </p>
      </div>

      <div className="tabs tabs-boxed mb-8 p-1 bg-base-300">
        <button
          className={`tab tab-lg ${activeTab === "user" ? "tab-active font-semibold" : ""}`}
          onClick={() => setActiveTab("user")}
        >
          1. User (身份与证明)
        </button>
        <button
          className={`tab tab-lg ${activeTab === "issuer" ? "tab-active font-semibold" : ""}`}
          onClick={() => setActiveTab("issuer")}
        >
          2. Issuer (KYC发证入群)
        </button>
        <button
          className={`tab tab-lg ${activeTab === "verifier" ? "tab-active font-semibold" : ""}`}
          onClick={() => setActiveTab("verifier")}
        >
          3. Verifier (链上验证与DeFi)
        </button>
      </div>

      <div className="w-full max-w-3xl bg-base-200 p-8 rounded-2xl shadow-xl border border-base-300">
        {activeTab === "user" && (
          <div className="flex flex-col gap-5">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">第一步：用户身份生成与隐私证明</h2>
              <span className="badge badge-primary badge-outline text-xs">Client-Side ZK</span>
            </div>
            <p className="text-sm opacity-80 leading-relaxed">
              您的 Semaphore
              隐私身份完全在浏览器本地计算生成，私钥永远不会离开设备，保证真实链下身份不与钱包地址直接关联。
            </p>

            {isIdentityLoading ? (
              <div className="flex items-center gap-2 p-4">
                <span className="loading loading-spinner"></span> 正在加载本地身份...
              </div>
            ) : identity ? (
              <div className="bg-base-300 p-5 rounded-xl border border-base-content/10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">当前本地身份已就绪</span>
                  {isMemberInGroup ? (
                    <span className="badge badge-success gap-1 text-xs py-2 px-3 font-semibold text-white">
                      已在链上群组发证
                    </span>
                  ) : (
                    <span className="badge badge-warning gap-1 text-xs py-2 px-3 font-semibold">
                      待发证 (前往 Tab 2)
                    </span>
                  )}
                </div>
                <div className="bg-base-100 p-3 rounded-lg font-mono text-xs break-all border border-base-300">
                  <strong className="text-base-content/70 block mb-1">Identity Commitment (公钥哈希):</strong>
                  {identity.commitment.toString()}
                </div>
                <div className="flex justify-between items-center pt-1">
                  <button className="btn btn-error btn-xs btn-outline" onClick={clearIdentity}>
                    清空/重置本地身份
                  </button>
                  {!isMemberInGroup && (
                    <button className="btn btn-primary btn-xs" onClick={() => setActiveTab("issuer")}>
                      前往 Tab 2 完成 KYC 发证
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 p-4 bg-base-300 rounded-xl border border-dashed border-base-content/20">
                <button className="btn btn-primary flex-1" onClick={createIdentity}>
                  生成随机匿名身份
                </button>
                <button className="btn btn-secondary flex-1" onClick={() => createDeterministicIdentity(address)}>
                  钱包签名派生确定性身份
                </button>
              </div>
            )}

            <div className="divider my-2"></div>

            <div className="flex flex-col gap-3">
              <h3 className="text-lg font-bold flex items-center gap-2">生成零知识证明 (ZK Proof)</h3>
              <p className="text-xs opacity-80">
                证明您在链上合规群组中，但<strong>不会透露</strong>
                具体是哪一个身份，并将当前连接的钱包地址作为防抢跑参数。
              </p>

              <div className="flex items-center justify-between text-xs bg-base-300 px-4 py-2 rounded-lg">
                <span>
                  链上群组当前成员总数：<strong>{isMembersLoading ? "加载中..." : groupMembers.length}</strong>
                </span>
                <span>
                  群组 ID：<strong>{groupId?.toString() ?? "加载中..."}</strong>
                </span>
              </div>

              {!isMemberInGroup && identity && (
                <div className="alert alert-warning text-xs py-2 shadow-sm">
                  <span>
                    提示：您当前生成的身份尚未在链上群组注册，请先点击上方按钮前往 [Tab 2. Issuer]
                    发证入群，否则无法生成 Merkle 树证明。
                  </span>
                </div>
              )}

              <button
                className="btn btn-secondary w-full mt-1"
                onClick={handleGenerateProof}
                disabled={!identity || isGenerating || !isMemberInGroup}
              >
                {isGenerating ? (
                  <>
                    <span className="loading loading-spinner"></span> 正在本地计算零知识证明 (Groth16)...
                  </>
                ) : !identity ? (
                  "请先生成本地身份"
                ) : !isMemberInGroup ? (
                  "未在群组中 (请先前往 Tab 2 发证)"
                ) : (
                  "生成零知识证明 (ZK Proof)"
                )}
              </button>

              {proofError && (
                <div className="alert alert-error text-xs py-2 shadow-sm">
                  <span>{proofError}</span>
                </div>
              )}

              {proof && (
                <div className="bg-success/15 border border-success/30 text-base-content p-4 rounded-xl flex flex-col gap-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-success text-sm flex items-center gap-1">零知识证明已生成完毕</span>
                    <button className="btn btn-success btn-xs text-white" onClick={() => setActiveTab("verifier")}>
                      前往 Tab 3 验证铸造
                    </button>
                  </div>
                  <p className="font-mono text-xs truncate bg-base-100 p-2 rounded border border-base-300">
                    <span className="opacity-70 font-sans">Nullifier Hash: </span>
                    {proof.nullifier.toString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "issuer" && (
          <div className="flex flex-col gap-5">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">第二步：Issuer 机构 KYC 与上链发证</h2>
              <span className="badge badge-secondary badge-outline text-xs">Authority Role</span>
            </div>
            <p className="text-sm opacity-80 leading-relaxed">
              在此环节，合规发证机构验证链下身份（如护照、制裁名单筛查）后，将用户的匿名 Commitment 添加到链上 Semaphore
              合规群组中。
            </p>

            <div className="bg-base-300 p-4 rounded-xl border border-base-content/10 flex flex-col gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-base-content/70">目标群组 ID (Group ID):</span>
                <span className="font-mono font-bold">{groupId?.toString() || "加载中..."}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/70">待发证 Identity Commitment:</span>
                <span className="font-mono font-bold truncate max-w-[280px] sm:max-w-md">
                  {currentCommitmentStr || "(未在 Tab 1 生成身份)"}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-base-content/70">群组发证状态:</span>
                {isMemberInGroup ? (
                  <span className="badge badge-success text-white font-semibold">该身份已在群组中</span>
                ) : (
                  <span className="badge badge-warning font-semibold">未发证 (待上链)</span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-base-content/70">发证机构地址 (Issuer):</span>
              <span className="font-mono font-bold">
                {issuerAddress
                  ? `${(issuerAddress as string).slice(0, 10)}…${(issuerAddress as string).slice(-6)}`
                  : "加载中..."}
              </span>
            </div>

            {!isMemberInGroup && (
              <div className={`alert text-xs py-2 shadow-sm ${isIssuerWallet ? "alert-success" : "alert-info"}`}>
                {isIssuerWallet ? (
                  <span>当前钱包即为发证机构，可直接为本 Commitment 发证上链。</span>
                ) : demoIssuerWallet ? (
                  <span>
                    当前钱包不是发证机构。合约仅允许 Issuer 发证，可点击下方「演示机构发证」用内置 Demo Issuer
                    完成上链（测试网演示专用）。
                  </span>
                ) : (
                  <span>
                    当前钱包不是发证机构（Issuer），合约会拒绝自行发证。请改用发证机构钱包，或让演示方为你的 Commitment
                    发证后再回到 Tab 1 生成证明。
                  </span>
                )}
              </div>
            )}

            <button
              className="btn btn-primary w-full"
              onClick={handleIssueCredential}
              disabled={groupId === undefined || isIssuing || isMemberInGroup || !identity || !isIssuerWallet}
            >
              {isIssuing ? (
                <>
                  <span className="loading loading-spinner"></span> 正在上链发证中 (等待交易确认)...
                </>
              ) : isMemberInGroup ? (
                "该身份已完成发证入群 (无需重复操作)"
              ) : !isIssuerWallet ? (
                "当前钱包非发证机构 (Issuer)"
              ) : (
                "审核 KYC 并发证上链 (Add to Semaphore Group)"
              )}
            </button>

            {demoIssuerWallet && !isMemberInGroup && identity && (
              <button className="btn btn-outline btn-secondary w-full" onClick={handleDemoIssue}>
                演示机构发证（Demo Issuer / 测试网专用）
              </button>
            )}

            {isMemberInGroup && (
              <div className="flex justify-end">
                <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab("user")}>
                  返回 Tab 1 生成零知识证明
                </button>
              </div>
            )}

            <p className="text-xs opacity-60 text-center">
              * 在完整商业流程中，此步由 Chainlink CRE 自动化工作流与合规机构私钥授权执行。
            </p>
          </div>
        )}

        {activeTab === "verifier" && (
          <div className="flex flex-col gap-5">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">第三步：业务端链上零知识验证与权限解锁</h2>
              <span className="badge badge-accent badge-outline text-xs">DeFi / DApp Gate</span>
            </div>
            <p className="text-sm opacity-80 leading-relaxed">
              DeFi 协议或 DApp 智能合约在链上直接验证 Groth16 零知识证明。验证通过后即可铸造
              AccessNFT，赋予合规交易权限。
            </p>

            <div className="bg-base-300 p-4 rounded-xl border border-base-content/10 flex flex-col gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-base-content/70">当前钱包地址:</span>
                <span className="font-mono font-bold">{address || "未连接钱包"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/70">ZK 证明就绪状态:</span>
                <span className={`font-bold ${proof ? "text-success" : "text-warning"}`}>
                  {proof ? "已在本地生成证明" : "未生成 (请先在 Tab 1 生成)"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/70">AccessNFT 拥有状态:</span>
                <span className="font-bold">{hasMinted ? "已持有合规通行证" : "未持有"}</span>
              </div>
            </div>

            <button
              className="btn btn-accent w-full text-white font-bold"
              onClick={handleVerifyProof}
              disabled={!proof || hasMinted || isVerifying}
            >
              {isVerifying ? (
                <>
                  <span className="loading loading-spinner"></span> 链上正在验证 ZK 证明并铸造 NFT...
                </>
              ) : hasMinted ? (
                "已验证合规身份 (AccessNFT 已铸造)"
              ) : !proof ? (
                "请先在 Tab 1 生成零知识证明"
              ) : (
                "提交链上验证并铸造 AccessNFT"
              )}
            </button>

            {hasMinted && (
              <div className="mt-4 p-6 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-2xl text-white shadow-2xl transition-all duration-500">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-2xl font-extrabold flex items-center gap-2">
                    <span className="text-3xl">🔓</span> 合规 DeFi 隐私金库已解锁！
                  </h3>
                  <span className="badge badge-warning badge-lg font-bold text-gray-900">Verified Access</span>
                </div>
                <p className="opacity-90 text-sm mb-4 leading-relaxed">
                  恭喜！您的钱包已通过零知识证明链上验证，成功进入受监管的高净值合规流动性池，链上合约无法追溯您的真实身份。
                </p>

                <div className="bg-white/15 p-4 rounded-xl backdrop-blur-md border border-white/20 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm opacity-90">模拟合规资金池余额:</span>
                    <span className="font-mono text-2xl font-black text-amber-300">100.00 USDC</span>
                  </div>
                  <p className="text-xs opacity-75">* 此为实测 Demo 展示面板，已完成完整的链上闭环验证。</p>
                  <div className="flex gap-3 pt-1">
                    <button className="btn btn-sm flex-1 border-none bg-white text-indigo-700 hover:bg-gray-100 font-bold">
                      Swap 隐私闪兑
                    </button>
                    <button className="btn btn-sm flex-1 border-none bg-indigo-900 text-white hover:bg-indigo-950 font-bold">
                      Stake 合规质押
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="w-full max-w-3xl mt-6 bg-base-200 p-5 rounded-2xl border border-base-300 text-xs">
        <h3 className="text-sm font-bold mb-3">链上实时状态 (Sepolia)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          <div className="flex justify-between gap-3">
            <span className="opacity-70">ComplianceGate</span>
            {gateContract ? (
              <a
                className="link font-mono"
                href={`https://sepolia.etherscan.io/address/${gateContract.address}`}
                target="_blank"
                rel="noreferrer"
              >
                {gateContract.address.slice(0, 10)}…{gateContract.address.slice(-6)}
              </a>
            ) : (
              <span className="font-mono">加载中...</span>
            )}
          </div>
          <div className="flex justify-between gap-3">
            <span className="opacity-70">群组 ID</span>
            <span className="font-mono">{groupId?.toString() ?? "加载中..."}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="opacity-70">链上成员数</span>
            <span className="font-mono">{isMembersLoading ? "加载中..." : groupMembers.length}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="opacity-70">Demo Mode</span>
            <span className="font-mono">{isDemoMode === undefined ? "加载中..." : String(isDemoMode)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="opacity-70">Issuer</span>
            <span className="font-mono">
              {issuerAddress ? `${(issuerAddress as string).slice(0, 10)}…` : "加载中..."}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="opacity-70">CRE Workflow</span>
            <span className="font-mono">
              {workflowAddress ? `${(workflowAddress as string).slice(0, 10)}…` : "加载中..."}
            </span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-3xl mt-4 bg-base-200 p-5 rounded-2xl border border-base-300 text-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">CRE 数据源 · 外部制裁名单</h3>
          {!sanctions || sanctions.error ? (
            <span className="badge badge-ghost">未连接</span>
          ) : sanctionedMembers.length > 0 ? (
            <span className="badge badge-error text-white">{sanctionedMembers.length} 命中</span>
          ) : (
            <span className="badge badge-success text-white">无命中</span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          <div className="flex justify-between gap-3">
            <span className="opacity-70">名单条目数</span>
            <span className="font-mono">{sanctions ? sanctions.sanctioned.length : "加载中..."}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="opacity-70">链上成员命中数</span>
            <span className="font-mono">{isMembersLoading ? "加载中..." : sanctionedMembers.length}</span>
          </div>
          <div className="flex justify-between gap-3 sm:col-span-2">
            <span className="opacity-70">数据源</span>
            <span className="font-mono truncate max-w-[240px]" title={sanctions?.source ?? undefined}>
              {sanctions?.source ?? "—"}
            </span>
          </div>
          <div className="flex justify-between gap-3 sm:col-span-2">
            <span className="opacity-70">同步时间</span>
            <span className="font-mono">{sanctionsUpdatedAt}</span>
          </div>
        </div>
        {sanctions?.error && <p className="mt-2 opacity-70 break-all">制裁名单接口当前不可用：{sanctions.error}</p>}
        <p className="mt-3 opacity-70 leading-relaxed">
          该名单与 CRE 工作流的制裁数据源一致，命中成员会进入 revokeCredential
          撤销路径。此处只展示实时同步和交集结果，不会从浏览器发起交易。
        </p>
      </div>
    </div>
  );
}
