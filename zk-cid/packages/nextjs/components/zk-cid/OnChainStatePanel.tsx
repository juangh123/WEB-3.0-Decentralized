"use client";

import { useLanguage } from "./LanguageContext";
import { RevocationFeed } from "./RevocationFeed";

type OnChainStatePanelProps = {
  gateAddress?: string;
  groupId?: bigint;
  groupMemberCount: number;
  isMembersLoading: boolean;
  isDemoMode?: boolean;
  issuerAddress?: string;
  workflowAddress?: string;
};

export const OnChainStatePanel = ({
  gateAddress,
  groupId,
  groupMemberCount,
  isMembersLoading,
  isDemoMode,
  issuerAddress,
  workflowAddress,
}: OnChainStatePanelProps) => {
  const { t } = useLanguage();

  return (
    <div className="w-full max-w-3xl mt-6 bg-base-200 p-5 rounded-2xl border border-base-300 text-xs">
      <h3 className="text-sm font-bold mb-3">
        {t("链上实时状态 (Sepolia)", "Live on-chain state (Sepolia)")}
        <span className="font-normal opacity-60"> · Live On-Chain State</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        <div className="flex justify-between gap-3">
          <span className="opacity-70">ComplianceGate</span>
          {gateAddress ? (
            <a
              className="link font-mono"
              href={`https://sepolia.etherscan.io/address/${gateAddress}`}
              target="_blank"
              rel="noreferrer"
            >
              {gateAddress.slice(0, 10)}…{gateAddress.slice(-6)}
            </a>
          ) : (
            <span className="font-mono">{t("加载中...", "Loading...")}</span>
          )}
        </div>
        <div className="flex justify-between gap-3">
          <span className="opacity-70">{t("群组 ID", "Group ID")}</span>
          <span className="font-mono">{groupId?.toString() ?? t("加载中...", "Loading...")}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="opacity-70">{t("源码验证 / Verified", "Source verification")}</span>
          {gateAddress ? (
            <span className="flex gap-2 font-mono">
              <a
                className="link"
                href={`https://eth-sepolia.blockscout.com/address/${gateAddress}#code`}
                target="_blank"
                rel="noreferrer"
              >
                Blockscout
              </a>
              <a
                className="link"
                href={`https://sourcify.dev/server/repo-ui/11155111/${gateAddress}`}
                target="_blank"
                rel="noreferrer"
              >
                Sourcify
              </a>
            </span>
          ) : (
            <span className="font-mono">{t("加载中...", "Loading...")}</span>
          )}
        </div>
        <div className="flex justify-between gap-3">
          <span className="opacity-70">{t("链上成员数", "On-chain members")}</span>
          <span className="font-mono">{isMembersLoading ? t("加载中...", "Loading...") : groupMemberCount}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="opacity-70">Demo Mode</span>
          <span className="font-mono">
            {isDemoMode === undefined ? t("加载中...", "Loading...") : String(isDemoMode)}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="opacity-70">Issuer</span>
          <span className="font-mono">
            {issuerAddress ? `${(issuerAddress as string).slice(0, 10)}…` : t("加载中...", "Loading...")}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="opacity-70">CRE Workflow</span>
          <span className="font-mono">
            {workflowAddress ? `${(workflowAddress as string).slice(0, 10)}…` : t("加载中...", "Loading...")}
          </span>
        </div>
      </div>
      <RevocationFeed />
    </div>
  );
};
