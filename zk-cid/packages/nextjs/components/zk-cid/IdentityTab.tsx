"use client";

import { useLanguage } from "./LanguageContext";
import type { Identity } from "@semaphore-protocol/identity";
import type { SemaphoreProof } from "@semaphore-protocol/proof";

type IdentityTabProps = {
  identity: Identity | null;
  isIdentityLoading: boolean;
  isMemberInGroup: boolean;
  isMembersLoading: boolean;
  groupMemberCount: number;
  groupId?: bigint;
  isGenerating: boolean;
  proof: SemaphoreProof | null;
  proofError: string | null;
  walletAddress?: string;
  onCreateIdentity: () => void;
  onCreateDeterministicIdentity: (address?: string) => void;
  onClearIdentity: () => void;
  onGenerateProof: () => void;
  onGoToIssuer: () => void;
  onGoToVerifier: () => void;
};

export const IdentityTab = ({
  identity,
  isIdentityLoading,
  isMemberInGroup,
  isMembersLoading,
  groupMemberCount,
  groupId,
  isGenerating,
  proof,
  proofError,
  walletAddress,
  onCreateIdentity,
  onCreateDeterministicIdentity,
  onClearIdentity,
  onGenerateProof,
  onGoToIssuer,
  onGoToVerifier,
}: IdentityTabProps) => {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h2 className="text-2xl font-bold">
          {t("第一步：用户身份生成与隐私证明", "Step 1 · Identity & Proof")}
          <span className="block text-sm font-normal opacity-70 mt-1">
            {t("在浏览器本地生成身份与零知识证明", "Generate your identity and a zero-knowledge proof locally")}
          </span>
        </h2>
        <span className="badge badge-primary badge-outline text-xs shrink-0">Client-Side ZK</span>
      </div>
      <p className="text-sm opacity-80 leading-relaxed">
        {t(
          "您的 Semaphore 隐私身份完全在浏览器本地计算生成，私钥永远不会离开设备，保证真实链下身份不与钱包地址直接关联。",
          "Your Semaphore identity is generated entirely in the browser. The private key never leaves the device, so the real-world identity is not directly linked to the wallet address.",
        )}
      </p>

      {isIdentityLoading ? (
        <div className="flex items-center gap-2 p-4">
          <span className="loading loading-spinner"></span> {t("正在加载本地身份...", "Loading local identity...")}
        </div>
      ) : identity ? (
        <div className="bg-base-300 p-5 rounded-xl border border-base-content/10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              {t("当前本地身份已就绪", "Local identity ready")}
            </span>
            {isMemberInGroup ? (
              <span className="badge badge-success gap-1 text-xs py-2 px-3 font-semibold text-white">
                {t("已在链上群组发证", "Credential issued on-chain")}
              </span>
            ) : (
              <span className="badge badge-warning gap-1 text-xs py-2 px-3 font-semibold">
                {t("待发证 (前往 Tab 2)", "Not issued yet (go to Tab 2)")}
              </span>
            )}
          </div>
          <div className="bg-base-100 p-3 rounded-lg font-mono text-xs break-all border border-base-300">
            <strong className="text-base-content/70 block mb-1">
              {t("Identity Commitment (公钥哈希):", "Identity commitment (public hash):")}
            </strong>
            {identity.commitment.toString()}
          </div>
          <div className="flex justify-between items-center pt-1">
            <button className="btn btn-error btn-xs btn-outline" onClick={onClearIdentity}>
              {t("清空/重置本地身份", "Clear / reset identity")}
            </button>
            {!isMemberInGroup && (
              <button className="btn btn-primary btn-xs" onClick={onGoToIssuer}>
                {t("前往 Tab 2 完成 KYC 发证", "Go to Tab 2 for KYC issuance")}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-3 p-4 bg-base-300 rounded-xl border border-dashed border-base-content/20">
          <button className="btn btn-primary flex-1" onClick={onCreateIdentity}>
            {t("生成随机匿名身份", "Generate random anonymous identity")}
          </button>
          <button className="btn btn-secondary flex-1" onClick={() => onCreateDeterministicIdentity(walletAddress)}>
            {t("钱包签名派生确定性身份", "Derive identity from wallet signature")}
          </button>
        </div>
      )}

      <div className="divider my-2"></div>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-bold flex items-center gap-2">
          {t("生成零知识证明 (ZK Proof)", "Generate zero-knowledge proof")}
        </h3>
        <p className="text-xs opacity-80">
          {t("证明您在链上合规群组中，但", "Prove membership in the on-chain compliance group without revealing")}
          <strong>{t("不会透露", " which identity you are")}</strong>
          {t(
            "具体是哪一个身份，并将当前连接的钱包地址作为防抢跑参数。",
            ". The connected wallet address is bound to the proof to prevent front-running.",
          )}
        </p>

        <div className="flex items-center justify-between text-xs bg-base-300 px-4 py-2 rounded-lg">
          <span>
            {t("链上群组当前成员总数：", "On-chain group members: ")}
            <strong>{isMembersLoading ? t("加载中...", "Loading...") : groupMemberCount}</strong>
          </span>
          <span>
            {t("群组 ID：", "Group ID: ")}
            <strong>{groupId?.toString() ?? t("加载中...", "Loading...")}</strong>
          </span>
        </div>

        {!isMemberInGroup && identity && (
          <div className="alert alert-warning text-xs py-2 shadow-sm">
            <span>
              {t(
                "提示：您当前生成的身份尚未在链上群组注册，请先点击上方按钮前往 [Tab 2. Issuer] 发证入群，否则无法生成 Merkle 树证明。",
                "This identity is not registered in the on-chain group yet. Go to Tab 2 and issue a credential before generating a Merkle proof.",
              )}
            </span>
          </div>
        )}

        <button
          className="btn btn-secondary w-full mt-1"
          onClick={onGenerateProof}
          disabled={!identity || isGenerating || !isMemberInGroup}
        >
          {isGenerating ? (
            <>
              <span className="loading loading-spinner"></span>{" "}
              {t("正在本地计算零知识证明 (Groth16)...", "Generating the Groth16 proof locally...")}
            </>
          ) : !identity ? (
            t("请先生成本地身份", "Create a local identity first")
          ) : !isMemberInGroup ? (
            t("未在群组中 (请先前往 Tab 2 发证)", "Not in the group (issue a credential in Tab 2)")
          ) : (
            t("生成零知识证明 (ZK Proof)", "Generate ZK proof")
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
              <span className="font-bold text-success text-sm flex items-center gap-1">
                {t("零知识证明已生成完毕", "Zero-knowledge proof ready")}
              </span>
              <button className="btn btn-success btn-xs text-white" onClick={onGoToVerifier}>
                {t("前往 Tab 3 验证铸造", "Go to Tab 3 to verify and mint")}
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
  );
};
