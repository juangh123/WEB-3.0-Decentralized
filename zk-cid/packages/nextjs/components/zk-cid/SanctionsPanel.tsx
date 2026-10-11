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
  return (
    <div className="w-full max-w-3xl mt-4 bg-base-200 p-5 rounded-2xl border border-base-300 text-xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold">
          CRE 数据源 · 外部制裁名单 <span className="font-normal opacity-60">· External Sanctions List</span>
        </h3>
        {!sanctions || sanctions.error ? (
          <span className="badge badge-ghost">未连接</span>
        ) : sanctionedMemberCount > 0 ? (
          <span className="badge badge-error text-white">{sanctionedMemberCount} 命中</span>
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
          <span className="font-mono">{isMembersLoading ? "加载中..." : sanctionedMemberCount}</span>
        </div>
        <div className="flex justify-between gap-3 sm:col-span-2">
          <span className="opacity-70">数据源</span>
          <span className="font-mono truncate max-w-[240px]" title={sanctions?.source ?? undefined}>
            {sanctions?.source ?? "—"}
          </span>
        </div>
        <div className="flex justify-between gap-3 sm:col-span-2">
          <span className="opacity-70">同步时间</span>
          <span className="font-mono">{updatedAt}</span>
        </div>
      </div>
      {sanctions?.error && <p className="mt-2 opacity-70 break-all">制裁名单接口当前不可用：{sanctions.error}</p>}
      <p className="mt-3 opacity-70 leading-relaxed">
        该名单与 CRE 工作流的制裁数据源一致，命中成员会进入 revokeCredential
        撤销路径。此处只展示实时同步和交集结果，不会从浏览器发起交易。
      </p>
    </div>
  );
};
