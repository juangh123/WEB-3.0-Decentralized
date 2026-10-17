"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { IdentityTab } from "~~/components/zk-cid/IdentityTab";
import { IssuerTab } from "~~/components/zk-cid/IssuerTab";
import { LanguageProvider, useLanguage } from "~~/components/zk-cid/LanguageContext";
import { OnChainStatePanel } from "~~/components/zk-cid/OnChainStatePanel";
import { SanctionsPanel } from "~~/components/zk-cid/SanctionsPanel";
import { VerifierTab } from "~~/components/zk-cid/VerifierTab";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useDemoIssuer } from "~~/hooks/zk-cid/useDemoIssuer";
import { useIdentity } from "~~/hooks/zk-cid/useIdentity";
import { useProof } from "~~/hooks/zk-cid/useProof";
import { useSanctions } from "~~/hooks/zk-cid/useSanctions";
import { notification } from "~~/utils/scaffold-eth";

const ZKCIDDemoContent = () => {
  const { language, setLanguage, t } = useLanguage();
  const { address } = useAccount();
  const {
    identity,
    createIdentity,
    createDeterministicIdentity,
    clearIdentity,
    isLoading: isIdentityLoading,
  } = useIdentity();
  const { proof, generateZkProof, isGenerating, error: proofError } = useProof();
  const { sanctions } = useSanctions();
  const { enabled: demoIssuerEnabled, isIssuing: isDemoIssuing, issue: issueDemoCredential } = useDemoIssuer();

  const [activeTab, setActiveTab] = useState<"user" | "issuer" | "verifier">("user");
  const [mintTxHash, setMintTxHash] = useState<`0x${string}` | undefined>();

  // Read the Group ID from the Contract
  const { data: groupId } = useScaffoldReadContract({
    contractName: "ComplianceGate",
    functionName: "groupId",
  });

  // Read the live member set straight from the contract. Event-history reads start at
  // block 0 on Sepolia, which public RPC endpoints reject or time out, so the demo used
  // to render "0 members" even though the on-chain group already had entries.
  const {
    data: onChainMembers,
    isLoading: isMembersLoading,
    refetch: refetchMembers,
  } = useScaffoldReadContract({
    contractName: "ComplianceGate",
    functionName: "getMembers",
  });

  // Semaphore trees retain revoked leaves as zero values. Reading getMembers() would
  // rebuild a compact tree with different indices and a different root after any
  // revocation, so proof generation must use the stable on-chain leaves instead.
  const { data: onChainLeaves, refetch: refetchLeaves } = useScaffoldReadContract({
    contractName: "ComplianceGate",
    functionName: "getLeaves",
  });

  const groupMembers = useMemo(() => {
    if (!onChainMembers) return [];
    return (onChainMembers as readonly bigint[]).map(member => member.toString());
  }, [onChainMembers]);
  const merkleLeaves = useMemo(() => {
    if (!onChainLeaves) return [];
    return (onChainLeaves as readonly bigint[]).map(leaf => leaf.toString());
  }, [onChainLeaves]);

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

  const isIssuerWallet =
    !!address && !!issuerAddress && address.toLowerCase() === (issuerAddress as string).toLowerCase();

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
      notification.error(t("请先在 Tab 1 生成本地身份！", "Create a local identity in Tab 1 first."));
      setActiveTab("user");
      return;
    }
    if (isMemberInGroup) {
      notification.info(
        t("该身份 Commitment 已经在群组中，无需重复发证！", "This commitment is already in the group."),
      );
      return;
    }
    try {
      await writeComplianceGate({
        functionName: "issueCredential",
        args: [BigInt(identity.commitment.toString())],
      });
      notification.success(
        t(
          "凭据发证成功！身份已加入链上 Semaphore 群组。",
          "Credential issued. The identity is now in the on-chain Semaphore group.",
        ),
      );
    } catch (e: any) {
      console.error(e);
      notification.error(
        e?.message ||
          t("发证失败，请检查钱包网络与交易。", "Issuance failed. Check the wallet network and transaction."),
      );
    }
  };

  const handleDemoIssue = async () => {
    if (!identity) {
      notification.error(t("请先在 Tab 1 生成本地身份！", "Create a local identity in Tab 1 first."));
      setActiveTab("user");
      return;
    }
    if (!demoIssuerEnabled || isDemoIssuing) return;
    try {
      await issueDemoCredential(identity.commitment.toString());
      notification.success(t("演示机构已发证上链（Demo Issuer）。", "The demo issuer added the credential on-chain."));
      await Promise.all([refetchMembers(), refetchLeaves()]);
    } catch (e: any) {
      console.error(e);
      notification.error(
        e?.message ||
          t(
            "演示机构发证失败，请检查服务端 Demo Issuer 配置。",
            "Demo issuance failed. Check the server-side Demo Issuer configuration.",
          ),
      );
    }
  };

  const handleGenerateProof = async () => {
    if (!identity) {
      return notification.error(t("请先生成或连接本地身份。", "Create or load a local identity first."));
    }
    if (!address) {
      return notification.error(
        t("请先在右上角连接您的以太坊钱包。", "Connect your Ethereum wallet in the top-right corner first."),
      );
    }
    if (groupId === undefined) {
      return notification.error(t("合约 Group ID 加载中，请稍候...", "The contract group ID is still loading."));
    }
    if (merkleLeaves.length === 0) {
      notification.error(
        t(
          "链上群组暂无任何成员！请先前往 Tab 2 进行 KYC 发证。",
          "The on-chain group has no members yet. Issue a credential in Tab 2 first.",
        ),
      );
      setActiveTab("issuer");
      return;
    }
    if (!isMemberInGroup) {
      notification.error(
        t(
          "当前身份尚未在链上群组注册！请先前往 Tab 2 完成发证。",
          "This identity is not in the on-chain group yet. Complete issuance in Tab 2 first.",
        ),
      );
      setActiveTab("issuer");
      return;
    }

    try {
      const generated = await generateZkProof(identity, merkleLeaves, groupId, address);
      if (generated) {
        notification.success(
          t(
            "零知识证明生成成功！现可前往 Tab 3 进行链上验证与铸造。",
            "Zero-knowledge proof generated. Continue to Tab 3 to verify and mint.",
          ),
        );
      }
    } catch (err: any) {
      notification.error(
        err?.message ||
          t(
            "零知识证明生成失败，请确认该身份已存在于链上群组。",
            "Proof generation failed. Confirm that the identity is in the on-chain group.",
          ),
      );
    }
  };

  const { writeContractAsync: writeAccessNFT, isPending: isVerifying } = useScaffoldWriteContract({
    contractName: "AccessNFT",
  });
  const { data: accessNftContract } = useDeployedContractInfo({ contractName: "AccessNFT" });

  const handleVerifyProof = async () => {
    if (!proof)
      return notification.error(t("请先在 Tab 1 生成零知识证明。", "Generate a zero-knowledge proof in Tab 1 first."));
    if (!address) return notification.error(t("请先连接钱包。", "Connect a wallet first."));

    try {
      const hash = await writeAccessNFT({
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
      if (hash) setMintTxHash(hash);
      notification.success(
        t(
          "合规验证通过！AccessNFT 铸造成功，已解锁 DeFi 权限。",
          "Compliance verified. AccessNFT minted and DeFi access unlocked.",
        ),
      );
    } catch (e: any) {
      console.error(e);
      notification.error(
        e?.message ||
          t(
            "验证或铸造失败（可能该钱包已铸造或证明无效）。",
            "Verification or mint failed (the wallet may already hold a pass, or the proof is invalid).",
          ),
      );
    }
  };

  return (
    <div className="flex flex-col items-center pt-10 px-4 pb-24 max-w-5xl mx-auto">
      <div className="w-full flex justify-end mb-2">
        <div className="join" role="group" aria-label={t("界面语言", "Interface language")}>
          <button
            type="button"
            className={`btn btn-xs join-item ${language === "en" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setLanguage("en")}
            aria-pressed={language === "en"}
          >
            EN
          </button>
          <button
            type="button"
            className={`btn btn-xs join-item ${language === "zh" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setLanguage("zh")}
            aria-pressed={language === "zh"}
          >
            中文
          </button>
        </div>
      </div>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">
          {t("ZK-CID 隐私合规身份实测", "ZK-CID Privacy Compliance Demo")}
        </h1>
        <p className="text-lg font-medium opacity-90 max-w-xl mx-auto mb-1">
          Privacy-Preserving Compliance Credentials, Live on Sepolia
        </p>
        <p className="text-base opacity-75 max-w-xl mx-auto">
          {t(
            "基于零知识证明 (Semaphore ZK) 与 Chainlink CRE 的链上合规隐私通行证与去中心化授权系统",
            "On-chain compliance passes and decentralized authorization powered by Semaphore ZK and Chainlink CRE.",
          )}
        </p>
      </div>

      <div className="tabs tabs-boxed mb-8 p-1 bg-base-300">
        <button
          className={`tab tab-lg ${activeTab === "user" ? "tab-active font-semibold" : ""}`}
          onClick={() => setActiveTab("user")}
        >
          {t("1. User (身份与证明 / Identity & Proof)", "1. User · Identity & Proof")}
        </button>
        <button
          className={`tab tab-lg ${activeTab === "issuer" ? "tab-active font-semibold" : ""}`}
          onClick={() => setActiveTab("issuer")}
        >
          {t("2. Issuer (KYC发证入群 / Issue Credential)", "2. Issuer · KYC & Issuance")}
        </button>
        <button
          className={`tab tab-lg ${activeTab === "verifier" ? "tab-active font-semibold" : ""}`}
          onClick={() => setActiveTab("verifier")}
        >
          {t("3. Verifier (链上验证与DeFi / Verify & Mint)", "3. Verifier · Verify & Mint")}
        </button>
      </div>

      <div className="w-full max-w-3xl bg-base-200 p-8 rounded-2xl shadow-xl border border-base-300">
        {activeTab === "user" && (
          <IdentityTab
            identity={identity}
            isIdentityLoading={isIdentityLoading}
            isMemberInGroup={isMemberInGroup}
            isMembersLoading={isMembersLoading}
            groupMemberCount={groupMembers.length}
            groupId={groupId}
            isGenerating={isGenerating}
            proof={proof}
            proofError={proofError}
            walletAddress={address}
            onCreateIdentity={createIdentity}
            onCreateDeterministicIdentity={createDeterministicIdentity}
            onClearIdentity={clearIdentity}
            onGenerateProof={handleGenerateProof}
            onGoToIssuer={() => setActiveTab("issuer")}
            onGoToVerifier={() => setActiveTab("verifier")}
          />
        )}

        {activeTab === "issuer" && (
          <IssuerTab
            hasIdentity={!!identity}
            commitment={currentCommitmentStr}
            isMemberInGroup={isMemberInGroup}
            groupId={groupId}
            issuerAddress={issuerAddress as string | undefined}
            isIssuerWallet={isIssuerWallet}
            demoIssuerEnabled={demoIssuerEnabled}
            isDemoIssuing={isDemoIssuing}
            isIssuing={isIssuing}
            onIssueCredential={handleIssueCredential}
            onDemoIssue={handleDemoIssue}
            onGoToUser={() => setActiveTab("user")}
          />
        )}

        {activeTab === "verifier" && (
          <VerifierTab
            walletAddress={address}
            hasProof={!!proof}
            hasMinted={hasMinted}
            isVerifying={isVerifying}
            mintTxHash={mintTxHash}
            accessNftAddress={accessNftContract?.address}
            onVerifyProof={handleVerifyProof}
          />
        )}
      </div>

      <OnChainStatePanel
        gateAddress={gateContract?.address}
        groupId={groupId}
        groupMemberCount={groupMembers.length}
        isMembersLoading={isMembersLoading}
        isDemoMode={isDemoMode}
        issuerAddress={issuerAddress as string | undefined}
        workflowAddress={workflowAddress as string | undefined}
      />

      <SanctionsPanel
        sanctions={sanctions}
        sanctionedMemberCount={sanctionedMembers.length}
        isMembersLoading={isMembersLoading}
        updatedAt={sanctionsUpdatedAt}
      />
    </div>
  );
};

export default function ZKCIDDemo() {
  return (
    <LanguageProvider>
      <ZKCIDDemoContent />
    </LanguageProvider>
  );
}
