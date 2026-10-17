"use client";

import { useLanguage } from "./LanguageContext";
import type { SanctionsPayload } from "~~/hooks/zk-cid/useSanctions";

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
    </div>
  );
};
