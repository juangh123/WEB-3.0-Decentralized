"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useScaffoldEventHistory, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useIdentity } from "~~/hooks/zk-cid/useIdentity";
import { useProof } from "~~/hooks/zk-cid/useProof";
import { notification } from "~~/utils/scaffold-eth";

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

  const { data: userAddedEvents, isLoading: isEventsLoading } = useScaffoldEventHistory({
    contractName: "ComplianceGate",
    eventName: "UserAdded",
    fromBlock: 0n,
    watch: true,
  });

  const groupMembers = useMemo(() => {
    if (!userAddedEvents) return [];
    return userAddedEvents.map(event => event.args.commitment?.toString() ?? "");
  }, [userAddedEvents]);

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
                  链上群组当前成员总数：<strong>{isEventsLoading ? "加载中..." : groupMembers.length}</strong>
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

            <button
              className="btn btn-primary w-full"
              onClick={handleIssueCredential}
              disabled={groupId === undefined || isIssuing || isMemberInGroup || !identity}
            >
              {isIssuing ? (
                <>
                  <span className="loading loading-spinner"></span> 正在上链发证中 (等待交易确认)...
                </>
              ) : isMemberInGroup ? (
                "该身份已完成发证入群 (无需重复操作)"
              ) : (
                "审核 KYC 并发证上链 (Add to Semaphore Group)"
              )}
            </button>

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
    </div>
  );
}
