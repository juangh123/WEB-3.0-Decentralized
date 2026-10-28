"use client";

import { useLanguage } from "./LanguageContext";
import type { SanctionsPayload } from "~~/hooks/zk-cid/useSanctions";

const REPO_URL = "https://github.com/juangh123/WEB-3.0-Decentralized/blob/main/zk-cid/workflows/compliance-lifecycle";
const CRE_EVIDENCE_URL = `${REPO_URL}/evidence/README.md`;
const CRE_SIMULATE_LOG_URL = `${REPO_URL}/evidence/cre-simulate-20261002-232950.log`;
const CRE_BROADCAST_TX_URL =
  "https://eth-sepolia.blockscout.com/tx/0xb64c050e37d7959951510eae66cc6994e11a7f640f8c4699f0d7e1050713e4d9";

type SanctionsPanelProps = {
  sanctions: SanctionsPayload | null;
  sanctionedMemberCount: number;
  isMembersLoading: boolean;
  updatedAt: string;
};

export const SanctionsPanel = ({
  sanctions,
  sanctionedMemberCount,
  isMembersLoading,
  updatedAt,
}: SanctionsPanelProps) => {
  const { t } = useLanguage();

  return (
    <div className="w-full max-w-3xl mt-4 bg-base-200 p-5 rounded-2xl border border-base-300 text-xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold">
          {t("CRE 数据源 · 外部制裁名单", "CRE data source · External sanctions list")}
          <span className="font-normal opacity-60"> · External Sanctions List</span>
        </h3>
        {!sanctions || sanctions.error ? (
          <span className="badge badge-ghost">{t("未连接", "Not connected")}</span>
        ) : sanctionedMemberCount > 0 ? (
          <span className="badge badge-error text-white">
            {t(
              `${sanctionedMemberCount} 命中`,
              `${sanctionedMemberCount} match${sanctionedMemberCount === 1 ? "" : "es"}`,
            )}
          </span>
        ) : (
          <span className="badge badge-success text-white">{t("无命中", "No matches")}</span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        <div className="flex justify-between gap-3">
          <span className="opacity-70">{t("名单条目数", "List entries")}</span>
          <span className="font-mono">{sanctions ? sanctions.sanctioned.length : t("加载中...", "Loading...")}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="opacity-70">{t("链上成员命中数", "On-chain matches")}</span>
          <span className="font-mono">{isMembersLoading ? t("加载中...", "Loading...") : sanctionedMemberCount}</span>
        </div>
        <div className="flex justify-between gap-3 sm:col-span-2">
          <span className="opacity-70">{t("数据源", "Source")}</span>
          <span className="font-mono truncate max-w-[240px]" title={sanctions?.source ?? undefined}>
            {sanctions?.source ?? "—"}
          </span>
        </div>
        <div className="flex justify-between gap-3 sm:col-span-2">
          <span className="opacity-70">{t("同步时间", "Synced at")}</span>
          <span className="font-mono">{updatedAt}</span>
        </div>
      </div>
      {sanctions?.error && (
        <p className="mt-2 opacity-70 break-all">
          {t("制裁名单接口当前不可用：", "Sanctions API unavailable: ")}
          {sanctions.error}
        </p>
      )}
      <p className="mt-3 opacity-70 leading-relaxed">
        {t(
          "该名单与 CRE 工作流的制裁数据源一致，命中成员会进入 revokeCredential 撤销路径。此处只展示实时同步和交集结果，不会从浏览器发起交易。",
          "This list is the same source used by the CRE workflow. Matches enter the revokeCredential path. This panel only shows the live sync and intersection; it never sends a transaction from the browser.",
        )}
      </p>
      {sanctionedMemberCount > 0 && !isMembersLoading && (
        <div className="mt-3 p-3 rounded-xl bg-warning/10 border border-warning/30 leading-relaxed" role="note">
          <p className="font-semibold mb-1">
            {t("为什么命中的成员仍在群组里？", "Why is a sanctioned member still in the group?")}
          </p>
          <p className="opacity-80">
            {t(
              "预置的演示承诺被刻意放进名单，方便评委看到命中。CRE 工作流每次运行都会撤销它：官方 cre workflow simulate 会走撤销分支，广播演练也曾在 Sepolia 上真实移除过同一个承诺。要让工作流在 Chainlink DON 上定时运行，需要 Chainlink 授予部署权限（需先完成商务接入），因此目前尚未定时运行。",
              "The seeded demo commitment is on the list on purpose so the match is visible. The CRE workflow revokes it whenever it runs: the official cre workflow simulate takes the revoke branch, and a broadcast rehearsal removed this same commitment on Sepolia. Running the workflow on a schedule on the Chainlink DON needs deploy access, which Chainlink grants after a commercial onboarding step, so it is not running on a schedule yet.",
            )}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            <a className="link link-primary" href={CRE_SIMULATE_LOG_URL} target="_blank" rel="noopener noreferrer">
              {t("CLI 模拟日志", "CLI simulation log")}
            </a>
            <a className="link link-primary" href={CRE_BROADCAST_TX_URL} target="_blank" rel="noopener noreferrer">
              {t("广播撤销交易", "Broadcast revocation tx")}
            </a>
            <a className="link link-primary" href={CRE_EVIDENCE_URL} target="_blank" rel="noopener noreferrer">
              {t("CRE 证据说明", "CRE evidence")}
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
