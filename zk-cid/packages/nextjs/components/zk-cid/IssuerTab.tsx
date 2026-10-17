"use client";

import { useLanguage } from "./LanguageContext";

type IssuerTabProps = {
  hasIdentity: boolean;
  commitment: string;
  isMemberInGroup: boolean;
  groupId?: bigint;
  issuerAddress?: string;
  isIssuerWallet: boolean;
  demoIssuerEnabled: boolean;
  isDemoIssuing: boolean;
  isIssuing: boolean;
  onIssueCredential: () => void;
  onDemoIssue: () => void;
  onGoToUser: () => void;
};

export const IssuerTab = ({
  hasIdentity,
  commitment,
  isMemberInGroup,
  groupId,
  issuerAddress,
  isIssuerWallet,
  demoIssuerEnabled,
  isDemoIssuing,
  isIssuing,
  onIssueCredential,
  onDemoIssue,
  onGoToUser,
}: IssuerTabProps) => {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h2 className="text-2xl font-bold">
          {t("第二步：Issuer 机构 KYC 与上链发证", "Step 2 · KYC & Issuance")}
          <span className="block text-sm font-normal opacity-70 mt-1">
            {t(
              "机构在链下完成 KYC，并将匿名承诺写入链上",
              "The issuer verifies KYC off-chain and adds the anonymous commitment on-chain",
            )}
          </span>
        </h2>
        <span className="badge badge-secondary badge-outline text-xs shrink-0">Authority Role</span>
      </div>
      <p className="text-sm opacity-80 leading-relaxed">
        {t(
          "在此环节，合规发证机构验证链下身份（如护照、制裁名单筛查）后，将用户的匿名 Commitment 添加到链上 Semaphore 合规群组中。",
          "The issuer verifies the user off-chain (documents, sanctions screening), then adds only the anonymous commitment to the on-chain Semaphore compliance group.",
        )}
      </p>

      <div className="bg-base-300 p-4 rounded-xl border border-base-content/10 flex flex-col gap-2 text-xs">
        <div className="flex justify-between">
          <span className="text-base-content/70">{t("目标群组 ID (Group ID):", "Target group ID:")}</span>
          <span className="font-mono font-bold">{groupId?.toString() || t("加载中...", "Loading...")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-base-content/70">
            {t("待发证 Identity Commitment:", "Identity commitment to issue:")}
          </span>
          <span className="font-mono font-bold truncate max-w-[280px] sm:max-w-md">
            {commitment || t("(未在 Tab 1 生成身份)", "(no identity created in Tab 1)")}
          </span>
        </div>
        <div className="flex justify-between items-center pt-1">
          <span className="text-base-content/70">{t("群组发证状态:", "Issuance status:")}</span>
          {isMemberInGroup ? (
            <span className="badge badge-success text-white font-semibold">
              {t("该身份已在群组中", "Identity already in group")}
            </span>
          ) : (
            <span className="badge badge-warning font-semibold">
              {t("未发证 (待上链)", "Not issued (pending on-chain)")}
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center text-xs">
        <span className="text-base-content/70">{t("发证机构地址 (Issuer):", "Issuer address:")}</span>
        <span className="font-mono font-bold">
          {issuerAddress
            ? `${(issuerAddress as string).slice(0, 10)}…${(issuerAddress as string).slice(-6)}`
            : t("加载中...", "Loading...")}
        </span>
      </div>

      {!isMemberInGroup && (
        <div className={`alert text-xs py-2 shadow-sm ${isIssuerWallet ? "alert-success" : "alert-info"}`}>
          {isIssuerWallet ? (
            <span>
              {t(
                "当前钱包即为发证机构，可直接为本 Commitment 发证上链。",
                "This wallet is the issuer and can add the commitment on-chain.",
              )}
            </span>
          ) : demoIssuerEnabled ? (
            <span>
              {t(
                "当前钱包不是发证机构。合约仅允许 Issuer 发证，可点击下方「演示机构发证」由服务端 Demo Issuer 代为上链（私钥不进入浏览器，测试网演示专用）。",
                "This wallet is not the issuer. The contract only accepts issuer-issued credentials. Use the demo issuer below to add the commitment server-side (the private key never enters the browser; testnet only).",
              )}
            </span>
          ) : (
            <span>
              {t(
                "当前钱包不是发证机构（Issuer），合约会拒绝自行发证。请改用发证机构钱包，或让演示方为你的 Commitment 发证后再回到 Tab 1 生成证明。",
                "This wallet is not the issuer, so the contract will reject a direct issuance. Switch to the issuer wallet, or use the demo issuer and then return to Tab 1 to generate the proof.",
              )}
            </span>
          )}
        </div>
      )}

      <button
        className="btn btn-primary w-full"
        onClick={onIssueCredential}
        disabled={groupId === undefined || isIssuing || isMemberInGroup || !hasIdentity || !isIssuerWallet}
      >
        {isIssuing ? (
          <>
            <span className="loading loading-spinner"></span>{" "}
            {t("正在上链发证中 (等待交易确认)...", "Issuing on-chain (waiting for confirmation)...")}
          </>
        ) : isMemberInGroup ? (
          t("该身份已完成发证入群 (无需重复操作)", "This identity is already in the group.")
        ) : !isIssuerWallet ? (
          t("当前钱包非发证机构 (Issuer)", "This wallet is not the issuer")
        ) : (
          t("审核 KYC 并发证上链 (Add to Semaphore Group)", "Approve KYC and issue on-chain (Add to Semaphore Group)")
        )}
      </button>

      {demoIssuerEnabled && !isMemberInGroup && hasIdentity && (
        <button className="btn btn-outline btn-secondary w-full" onClick={onDemoIssue} disabled={isDemoIssuing}>
          {isDemoIssuing ? (
            <>
              <span className="loading loading-spinner"></span>{" "}
              {t("演示机构发证中（等待链上确认）...", "Demo issuance in progress (waiting for confirmation)...")}
            </>
          ) : (
            t("演示机构发证（Demo Issuer / 测试网专用）", "Demo issuer (testnet only)")
          )}
        </button>
      )}

      {isMemberInGroup && (
        <div className="flex justify-end">
          <button className="btn btn-secondary btn-sm" onClick={onGoToUser}>
            {t("返回 Tab 1 生成零知识证明", "Return to Tab 1 to generate the proof")}
          </button>
        </div>
      )}

      <p className="text-xs opacity-60 text-center">
        {t(
          "* 在完整商业流程中，此步由 Chainlink CRE 自动化工作流与合规机构私钥授权执行。",
          "* In production, this step is executed by the issuer's authorized key with Chainlink CRE automation.",
        )}
      </p>
    </div>
  );
};
